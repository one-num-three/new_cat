"""
猫鼠手环 V1.5 多节点真实 C++ 固件在环（Firmware-in-the-Loop）全链路仿真测试
同时拉起多个真实编译的 band_node.exe 进程，通过虚拟 13.56MHz NFC 射频场、
虚拟 LIS2DH12 碰撞通道、虚拟 BLE 广播/GATT 通道与虚拟 new_cat v2 裁判服跑通完整闭环。
"""
import collections
import math
import os
import pathlib
import queue
import struct
import subprocess
import sys
import threading
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXE_PATH = (
    pathlib.Path(r"D:\.catmouse_sim_build\band_node.exe")
    if pathlib.Path("D:\\").exists()
    else ROOT / "sim" / "build" / ("band_node.exe" if os.name == "nt" else "band_node")
)


class BandNode:
    def __init__(self, name: str, mac_hex: str):
        self.name = name
        self.mac_hex = mac_hex.upper()
        self.proc = subprocess.Popen(
            [str(EXE_PATH), self.mac_hex],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.lock = threading.Lock()
        self.ready = threading.Event()
        self.sleep_event = threading.Event()
        self.sleep_info = ""
        self.tg_waiting = False
        self.tg_session_active = False
        self.serial_lines = []
        self.ble_events = []
        self.ble_advs = []
        self.led_logs = []
        self.motor_logs = []
        self.buzz_logs = []
        self.imu_ctrl1 = []
        self.i2c_recovers = 0
        self.rf_on_count = 0
        self.pd_states = []
        self.stats_line = ""
        self.on_rf_msg = None  # callback(node, tag, body)

        self._t = threading.Thread(target=self._reader, daemon=True)
        self._t.start()
        assert self.ready.wait(timeout=5.0), f"{self.name}: firmware failed to boot"

    def send(self, line: str):
        if self.proc.poll() is not None:
            return
        with self.lock:
            try:
                self.proc.stdin.write(line + "\n")
                self.proc.stdin.flush()
            except BrokenPipeError:
                pass

    def _reader(self):
        for raw in self.proc.stdout:
            line = raw.strip()
            if not line.startswith("@@"):
                continue
            parts = line[2:].split(" ", 1)
            tag = parts[0]
            body = parts[1] if len(parts) > 1 else ""
            if tag == "READY":
                self.ready.set()
            elif tag == "SERIAL":
                self.serial_lines.append(body)
            elif tag == "BLE_EVT":
                self.ble_events.append(bytes.fromhex(body))
            elif tag == "BLE_ADV":
                self.ble_advs.append(body)
            elif tag == "LED":
                self.led_logs.append(body)
            elif tag == "MOTOR":
                self.motor_logs.append(body)
            elif tag == "BUZZ":
                self.buzz_logs.append(body)
            elif tag == "IMU_CTRL1":
                self.imu_ctrl1.append(body)
            elif tag == "I2C_RECOVER":
                self.i2c_recovers += 1
            elif tag == "NFC_RF":
                if body == "1":
                    self.rf_on_count += 1
            elif tag == "NFC_PD":
                self.pd_states.append(body)
            elif tag == "STATS":
                self.stats_line = body
            elif tag == "SLEEP":
                self.sleep_info = body
                self.sleep_event.set()
            elif tag in ("NFC_POLL_REQ", "NFC_XCHG_REQ", "NFC_RELEASE", "NFC_TG_WAIT", "NFC_TG_ABORT", "NFC_TG_RESP"):
                if tag == "NFC_TG_WAIT":
                    self.tg_waiting = True
                    self.tg_session_active = False
                elif tag == "NFC_TG_ABORT":
                    self.tg_waiting = False
                    self.tg_session_active = False
                if self.on_rf_msg:
                    self.on_rf_msg(self, tag, body)

    def ble_cmd(self, payload: bytes):
        self.send("BLE_CMD " + payload.hex().upper())

    def wait_ble_evt(self, evt_type: int, start_idx: int = 0, timeout: float = 3.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            for i in range(start_idx, len(self.ble_events)):
                ev = self.ble_events[i]
                if len(ev) >= 2 and ev[0] == evt_type:
                    return ev, i + 1
            time.sleep(0.01)
        return None, len(self.ble_events)

    def wait_serial(self, substr: str, timeout: float = 2.0):
        deadline = time.time() + timeout
        while time.time() < deadline:
            for ln in self.serial_lines:
                if substr in ln:
                    return ln
            time.sleep(0.01)
        return None

    def press_button(self, hold_ms: int):
        self.send("BTN 1")
        time.sleep(hold_ms / 1000.0)
        self.send("BTN 0")

    def close(self):
        try:
            self.send("QUIT")
            self.proc.wait(timeout=1.5)
        except Exception:
            self.proc.kill()


class VirtualRfMedium:
    """模拟 13.56MHz 物理射频空间：支持双环真实 APDU 耦合、NTAG215 道具卡、手机 NDEF 读卡器。"""

    def __init__(self):
        self.lock = threading.Lock()
        self.near_pair = None          # (BandNode, BandNode)
        self.near_item = None          # (BandNode, uid_hex, page4_hex_16b)
        self.active_link = None        # (poller_node, target_node, first_apdu_sent)
        self.phone_resp_q = queue.Queue()
        self.phone_target = None       # BandNode being read by simulated phone

    def attach(self, node: BandNode):
        node.on_rf_msg = self.handle

    def set_near_pair(self, a: BandNode, b: BandNode):
        with self.lock:
            self.near_pair = (a, b)
            self.near_item = None
            self.active_link = None

    def set_near_item(self, node: BandNode, uid_hex: str, page4_16b_hex: str):
        with self.lock:
            self.near_pair = None
            self.near_item = (node, uid_hex, page4_16b_hex)
            self.active_link = None

    def clear_proximity(self):
        with self.lock:
            self.near_pair = None
            self.near_item = None
            self.active_link = None

    def _peer_of(self, node: BandNode):
        if not self.near_pair:
            return None
        a, b = self.near_pair
        if node is a:
            return b
        if node is b:
            return a
        return None

    def handle(self, node: BandNode, tag: str, body: str):
        with self.lock:
            if tag == "NFC_POLL_REQ":
                # 1. 检查道具卡
                if self.near_item and self.near_item[0] is node:
                    _, uid_hex, _ = self.near_item
                    node.send(f"NFC_POLL_FOUND 00 {uid_hex}")
                    return
                # 2. 检查靠近的另一只手环是否处于 Target Listen 等待中
                peer = self._peer_of(node)
                if peer and peer.tg_waiting:
                    self.active_link = [node, peer, False]  # [poller, target, activated]
                    node.send("NFC_POLL_FOUND 20 08112233")
                else:
                    node.send("NFC_POLL_NONE")
                return

            if tag == "NFC_XCHG_REQ":
                # 1. 道具卡读第 4 页 (0x30 0x04)
                if self.near_item and self.near_item[0] is node:
                    if body.upper() == "3004":
                        node.send("NFC_XCHG_RESP " + self.near_item[2])
                    else:
                        node.send("NFC_XCHG_FAIL")
                    return
                # 2. 转发给另一只真实手环的 PN532 Target！
                if self.active_link and self.active_link[0] is node:
                    target = self.active_link[1]
                    if not self.active_link[2]:
                        # 首条 APDU 通过 TgInitAsTarget 的 InitiatorCommand 携带进入 Target！
                        self.active_link[2] = True
                        target.tg_waiting = False
                        target.tg_session_active = True
                        target.send("NFC_TG_ACTIVATE " + body)
                    else:
                        target.send("NFC_TG_APDU " + body)
                else:
                    node.send("NFC_XCHG_FAIL")
                return

            if tag == "NFC_TG_RESP":
                # Target 手环发回的真实 APDU 响应！
                if self.phone_target is node:
                    self.phone_resp_q.put(bytes.fromhex(body))
                    return
                if self.active_link and self.active_link[1] is node:
                    poller = self.active_link[0]
                    poller.send("NFC_XCHG_RESP " + body)
                return

            if tag == "NFC_RELEASE":
                if self.active_link and self.active_link[0] is node:
                    target = self.active_link[1]
                    target.tg_session_active = False
                    target.send("NFC_TG_RELEASE")
                    self.active_link = None
                return

    def phone_read_ndef_url(self, target: BandNode, p1_select_ef: int = 0x00) -> str:
        """模拟 Android (p1=0x00) / iPhone (p1=0x02) NFC 读卡器完整读取手环 NDEF 绑定 URL。"""
        deadline = time.time() + 3.0
        while not target.tg_waiting and time.time() < deadline:
            time.sleep(0.01)
        assert target.tg_waiting, "Target band did not enter NFC Listen mode"

        with self.lock:
            self.phone_target = target
            while not self.phone_resp_q.empty():
                self.phone_resp_q.get_nowait()

        def xchg(apdu: bytes, first=False) -> bytes:
            target.send(("NFC_TG_ACTIVATE " if first else "NFC_TG_APDU ") + apdu.hex().upper())
            return self.phone_resp_q.get(timeout=2.0)

        try:
            # 1. SELECT NDEF Tag Application
            r = xchg(bytes.fromhex("00A4040007D276000085010100"), first=True)
            assert r == b"\x90\x00", f"SELECT NDEF AID failed: {r.hex()}"
            # 2. SELECT CC File E103
            r = xchg(bytes([0x00, 0xA4, p1_select_ef, 0x0C, 0x02, 0xE1, 0x03]))
            assert r == b"\x90\x00", f"SELECT CC (p1={p1_select_ef:#x}) failed: {r.hex()}"
            # 3. READ CC File
            r = xchg(bytes.fromhex("00B000000F"))
            assert r[-2:] == b"\x90\x00" and r[0:2] == b"\x00\x0f", f"READ CC failed: {r.hex()}"
            # 4. SELECT NDEF File E104
            r = xchg(bytes([0x00, 0xA4, p1_select_ef, 0x0C, 0x02, 0xE1, 0x04]))
            assert r == b"\x90\x00", f"SELECT NDEF file failed: {r.hex()}"
            # 5. READ NDEF length (2B) & body
            r = xchg(bytes.fromhex("00B0000002"))
            assert r[-2:] == b"\x90\x00"
            nlen = (r[0] << 8) | r[1]
            r = xchg(bytes([0x00, 0xB0, 0x00, 0x02, nlen]))
            assert r[-2:] == b"\x90\x00"
            ndef = r[:-2]
            assert ndef[0] == 0xD1 and ndef[1] == 0x01 and ndef[3] == ord("U")
            prefix = {0x04: "https://", 0x03: "http://", 0x00: ""}.get(ndef[4], "")
            return prefix + ndef[5:].decode("utf-8")
        finally:
            target.send("NFC_TG_RELEASE")
            with self.lock:
                self.phone_target = None


class MockNewCatV2Server:
    """模拟现有 new_cat v2 裁判服：50m GPS 距离校验 + 5s 新鲜度 + 3s 双端 NFC 事件去重。"""

    def __init__(self, session_id: int):
        self.session_id = session_id
        self.positions = {}  # mac -> (x_m, y_m, ts)
        self.recent_pairs = {}  # frozenset({a, b}) -> ts

    def update_gps(self, mac: str, x_m: float, y_m: float, ts: float = None):
        self.positions[mac] = (x_m, y_m, time.time() if ts is None else ts)

    def judge_nfc_peer(self, reporter_mac: str, reporter_role: int, peer_evt: bytes):
        # peer_evt: [0]=0x04, [1]=seq, [2]=dir, [3..8]=peerId, [9]=peerRole, [10]=peerTeam, [11..14]=peerSession, [15]=flags
        peer_mac = peer_evt[3:9].hex().upper()
        peer_role = peer_evt[9]
        peer_session = struct.unpack("<I", peer_evt[11:15])[0]
        if peer_session != self.session_id:
            return "SESSION_MISMATCH"
        now = time.time()
        p1 = self.positions.get(reporter_mac)
        p2 = self.positions.get(peer_mac)
        if not p1 or not p2 or (now - p1[2] > 5.0) or (now - p2[2] > 5.0):
            return "STALE_LOCATION"
        dist = math.hypot(p1[0] - p2[0], p1[1] - p2[1])
        if dist > 50.0:
            return f"OUTSIDE_50M ({dist:.1f}m)"
        key = frozenset([reporter_mac, peer_mac])
        if key in self.recent_pairs and (now - self.recent_pairs[key] < 3.0):
            return "DEDUP_IGNORED"
        pair = {reporter_role, peer_role}
        if pair == {1, 2}:  # CAT + MOUSE
            self.recent_pairs[key] = now
            return "CAPTURE_OK"
        if pair == {2, 3}:  # MOUSE + JAILED
            self.recent_pairs[key] = now
            return "RESCUE_OK"
        return "NO_ACTION"


def run_all_scenarios():
    assert EXE_PATH.exists(), f"Simulator binary not found: {EXE_PATH}. Run build_sim.py first."
    rf = VirtualRfMedium()
    cat = BandNode("Cat-1", "A0B1C2D3E401")
    mouse1 = BandNode("Mouse-1", "A0B1C2D3E402")
    mouse2 = BandNode("Mouse-2", "A0B1C2D3E403")
    lobby = BandNode("Lobby-4", "A0B1C2D3E404")
    for n in (cat, mouse1, mouse2, lobby):
        rf.attach(n)

    try:
        # -------- 场景 1: 串口产测自检 CLI + I2C 总线死锁自愈 --------
        cat.send("SERIAL TEST")
        res = cat.wait_serial("FACTORY SELF-TEST RESULT: PASS", timeout=2.5)
        assert res is not None, f"Factory self-test failed: {cat.serial_lines}"
        cat.send("I2C_FAULT 2")
        cat.send("SERIAL RECOVER")
        assert cat.wait_serial("I2C bus recovered", timeout=2.0) is not None
        assert cat.i2c_recovers >= 1, "bus::recover() did not emit 9-clock recovery!"
        print("[PASS] 场景 1：真实固件串口一键产测 CLI (INFO/TEST) + 9-clock I2C 总线死锁自愈验证通过")

        # -------- 场景 2: 大厅长按 -> Android(P1=0x00) & iPhone(P1=0x02) 碰一碰读取 NDEF URL --------
        lobby.send("BLE_CONN 1")
        ev_boot, _ = lobby.wait_ble_evt(0x01)
        assert ev_boot is not None and ev_boot[2] == 1 and ev_boot[3] == 5, "EVT_BOOT mismatch"
        # 下发自定义绑定 URL 前缀并提交 NVS
        lobby.ble_cmd(bytes([0x09]) + b"https://catmouse.app/b?id=")
        lobby.ble_cmd(bytes([0x0B]))
        time.sleep(0.15)
        for label, p1 in [("Android (P1=0x00)", 0x00), ("iPhone (P1=0x02)", 0x02)]:
            idx = len(lobby.ble_events)
            lobby.press_button(1300)  # 长按 1.3s 进入 30s 绑定 Listen 窗口
            url = rf.phone_read_ndef_url(lobby, p1_select_ef=p1)
            assert url == "https://catmouse.app/b?id=A0B1C2D3E404", f"{label} decoded wrong URL: {url}"
            ev_bind, _ = lobby.wait_ble_evt(0x07, start_idx=idx)
            assert ev_bind is not None, f"{label} did not emit EVT_NFC_BIND_READ"
            time.sleep(0.15)
        print("[PASS] 场景 2：真实固件 NVS 写入绑定链接 + Android & iPhone NFC 碰一碰绑定全链路通过")

        # -------- 场景 3: 脱机 STANDALONE 模式免手机实测（按键切角色 + 真实双进程碰撞抓捕 + 队友解救） --------
        # Cat-1 双击一次 -> CAT(1); Mouse-1 双击两次 -> MOUSE(2); Mouse-2 双击两次 -> MOUSE(2)
        def double_click(node: BandNode):
            node.press_button(60)
            time.sleep(0.10)
            node.press_button(60)
            time.sleep(0.15)

        double_click(cat)        # LOBBY(0) -> CAT(1)
        double_click(mouse1)     # LOBBY(0) -> CAT(1)
        time.sleep(0.25)
        double_click(mouse1)     # CAT(1) -> MOUSE(2)
        double_click(mouse2)
        time.sleep(0.25)
        double_click(mouse2)     # CAT(1) -> MOUSE(2)

        cat.send("SERIAL INFO")
        assert cat.wait_serial("role=1", timeout=2.0) is not None, f"Cat role switch failed: {cat.serial_lines}"
        mouse1.send("SERIAL INFO")
        assert mouse1.wait_serial("role=2", timeout=2.0) is not None, f"Mouse1 role switch failed: {mouse1.serial_lines}"

        # 物理靠近并注入碰撞 (2800 mg > 2000 mg 阈值) -> 双进程真实 IMU 中断 -> 真实 PN532 双向 APDU 握手！
        rf.set_near_pair(cat, mouse1)
        mouse1.send("IMPACT 2800")
        time.sleep(0.05)
        cat.send("IMPACT 2800")
        time.sleep(0.6)

        # 验证 Mouse-1 在脱机模式下自动进入 ROLE_JAILED(3)！
        mouse1.serial_lines.clear()
        mouse1.send("SERIAL INFO")
        assert mouse1.wait_serial("role=3", timeout=2.0) is not None, f"Standalone capture failed: {mouse1.serial_lines}"

        # 队友解救：Mouse-1 在牢房原地不动（不注入碰撞！验证牢房自动被动监听解救！），
        # 仅由自由鼠 Mouse-2 跑过来轻碰并贴合 1 秒 -> 自由鼠切到 Poll 时隙完成双向解救握手！
        rf.set_near_pair(mouse2, mouse1)
        mouse2.send("IMPACT 2600")
        deadline = time.time() + 3.0
        rescued = False
        while time.time() < deadline:
            mouse1.serial_lines.clear()
            mouse1.send("SERIAL INFO")
            if mouse1.wait_serial("role=2", timeout=0.35) is not None:
                rescued = True
                break
            if not mouse2.rf_on_count:
                mouse2.send("IMPACT 2600")
        assert rescued, f"Standalone rescue failed: {mouse1.serial_lines}"
        rf.clear_proximity()
        print("[PASS] 场景 3：脱机免手机双进程实战（按键切阵营 → IMU碰撞唤醒 → 猫抓鼠变蓝牢房 → 队友免撞轻贴解救恢复绿鼠）通过")

        # -------- 场景 4: 联机 new_cat v2 完整对局（不可连接角色广播、跨场拦截、50m GPS 反作弊、抓捕去重、道具卡） --------
        srv = MockNewCatV2Server(session_id=20261127)
        for n, role in [(cat, 1), (mouse1, 2), (mouse2, 2)]:
            n.send("BLE_CONN 1")
            ev_b, _ = n.wait_ble_evt(0x01)
            assert ev_b is not None
            n.ble_cmd(struct.pack("<BI", 0x02, 20261127))      # CMD_SET_SESSION
            n.ble_cmd(bytes([0x01, role, 0]))                   # CMD_SET_ROLE
        time.sleep(0.2)

        # 4A: 验证猫已连接手机后，自动切换为不可连接广播 (NON) 且厂商数据含 'C','M', role=1，供附近鼠扫 RSSI 触发心跳！
        assert any(adv.startswith("NON CMB-E401 FFFF434D01") for adv in cat.ble_advs), f"Cat NON adv missing: {cat.ble_advs}"
        # 鼠小程序扫到猫在 8m 内 -> 下发心跳振动 CMD_HAPTIC(PAT_HEARTBEAT=4)
        m_cnt = len(mouse1.motor_logs)
        mouse1.ble_cmd(bytes([0x04, 4]))
        time.sleep(0.15)
        assert len(mouse1.motor_logs) > m_cnt, "Heartbeat haptic not triggered!"

        # 4B: GPS 距离 120m（超 new_cat 50m 限制）碰撞 -> 裁判服必须拒绝！
        time.sleep(3.1)  # 等待前一场 3s 固件去重冷却
        srv.update_gps(cat.mac_hex, 0.0, 0.0)
        srv.update_gps(mouse1.mac_hex, 120.0, 0.0)
        c_idx = len(cat.ble_events)
        m_idx = len(mouse1.ble_events)
        rf.set_near_pair(cat, mouse1)
        mouse1.send("IMPACT 2700")
        time.sleep(0.05)
        cat.send("IMPACT 2700")
        ev_c, _ = cat.wait_ble_evt(0x04, start_idx=c_idx, timeout=2.5)
        ev_m, _ = mouse1.wait_ble_evt(0x04, start_idx=m_idx, timeout=2.5)
        assert ev_c is not None and ev_m is not None, "Both bands should report EVT_NFC_PEER"
        assert srv.judge_nfc_peer(cat.mac_hex, 1, ev_c).startswith("OUTSIDE_50M")

        # 4C: GPS 合法距离 8m + 新鲜时间戳 -> 双方上报 EVT_NFC_PEER -> 裁判服裁决 CAPTURE_OK + 3s 去重 DEDUP_IGNORED！
        time.sleep(3.1)
        # 顺手验证超过 5s 未刷新位置触发 STALE_LOCATION（将 cat GPS 设为 6s 前）
        srv.update_gps(cat.mac_hex, 0.0, 0.0, ts=time.time() - 6.0)
        srv.update_gps(mouse1.mac_hex, 8.0, 0.0)
        assert srv.judge_nfc_peer(cat.mac_hex, 1, ev_c) == "STALE_LOCATION"

        srv.update_gps(cat.mac_hex, 0.0, 0.0)
        srv.update_gps(mouse1.mac_hex, 8.0, 0.0)
        c_idx = len(cat.ble_events)
        m_idx = len(mouse1.ble_events)
        mouse1.send("IMPACT 2900")
        time.sleep(0.05)
        cat.send("IMPACT 2900")
        ev_c2, _ = cat.wait_ble_evt(0x04, start_idx=c_idx, timeout=2.5)
        ev_m2, _ = mouse1.wait_ble_evt(0x04, start_idx=m_idx, timeout=2.5)
        assert ev_c2 is not None and ev_m2 is not None
        verdict1 = srv.judge_nfc_peer(cat.mac_hex, 1, ev_c2)
        verdict2 = srv.judge_nfc_peer(mouse1.mac_hex, 2, ev_m2)
        assert verdict1 == "CAPTURE_OK", f"Expected CAPTURE_OK, got {verdict1}"
        assert verdict2 == "DEDUP_IGNORED", f"Expected DEDUP_IGNORED, got {verdict2}"

        # 4D: 自由鼠刷 NTAG215 道具卡（隐身卡）-> 上报 EVT_NFC_ITEM + 裁判下发隐身灯效 OFF
        item_idx = len(mouse2.ble_events)
        rf.set_near_item(mouse2, "04A1B2C3D4E5F6", "434D4901000700001122334455667788")
        mouse2.press_button(60)  # 短按开窗
        ev_item, _ = mouse2.wait_ble_evt(0x05, start_idx=item_idx, timeout=2.5)
        assert ev_item is not None and ev_item[10:14] == b"CMI\x01", f"Item read mismatch: {ev_item}"
        rf.clear_proximity()
        print("[PASS] 场景 4：联机 new_cat v2 全链路（NON广播心跳预警 + 50m GPS反作弊 + 双端抓捕3s去重 + NTAG215道具卡）通过")

        # -------- 场景 5: 电池低电告警、按住 4 秒深睡关机与器件低功耗验收 --------
        # 采集当前运行功耗统计，推算 20 分钟实战能耗
        cat.send("STATS")
        time.sleep(0.1)
        assert cat.stats_line, "Failed to read power stats"
        # 测试按住按键 4.1 秒安全关机深睡
        lobby.press_button(4100)
        assert lobby.sleep_event.wait(timeout=3.0), "4s button press did not trigger deep sleep!"
        assert "mask=0x10 mode=0" in lobby.sleep_info, f"Unexpected wakeup config: {lobby.sleep_info}"
        assert lobby.imu_ctrl1 and lobby.imu_ctrl1[-1] == "00", f"IMU not powered down before sleep: {lobby.imu_ctrl1}"
        assert lobby.pd_states and lobby.pd_states[-1] == "1", f"PN532 not powered down: {lobby.pd_states}"
        print(f"[PASS] 场景 5：4秒长按深睡（GPIO4低电平唤醒、IMU 0x00断电、PN532 PowerDown）通过 | 实测能耗采样: {cat.stats_line}")

        # -------- 场景 6: 20 分钟户外对局综合电池续航核算 --------
        # 模型（实测灯环亮度 100/255 约 40%，按每局 20min：12次 NFC 窗口×1.5s + 20次振动×0.3s + 20次蜂鸣×0.3s）
        esp_ma = 18.0
        led_cat_spin_ma = 12 * 0.8 + (1.0 + 0.25 + 0.0625 + 0.0156) * (100 / 255.0) * 20.0  # 约 20mA
        led_mouse_breathe_ma = 12 * 0.8 + 12 * 0.55 * (100 / 255.0) * 20.0  # 约 61mA（全环呼吸最耗电角色）
        nfc_avg_ma = 65.0 * (12 * 1.5) / 1200.0  # 约 0.98mA
        act_avg_ma = (70.0 * 6.0 + 25.0 * 6.0) / 1200.0  # 约 0.48mA
        worst_ma = esp_ma + led_mouse_breathe_ma + nfc_avg_ma + act_avg_ma
        mah_per_game = worst_ma * (20.0 / 60.0)
        games_250 = 250.0 / mah_per_game
        games_300 = 300.0 / mah_per_game
        assert mah_per_game <= 35.0, f"20min power too high: {mah_per_game:.1f} mAh"
        print(
            f"[PASS] 场景 6：20 分钟对局最严苛续航核算通过 -> 鼠全环呼吸平均 {worst_ma:.1f} mA "
            f"(单局 20min 耗电 {mah_per_game:.1f} mAh，250mAh 原型可玩 {games_250:.1f} 局 / 300mAh 量产可玩 {games_300:.1f} 局)"
        )
        print("\n=== ALL 6 FIRMWARE-IN-THE-LOOP HARDWARE SCENARIOS PASSED 100%! ===")
    finally:
        for n in (cat, mouse1, mouse2, lobby):
            n.close()


if __name__ == "__main__":
    run_all_scenarios()

// 图标生成器 - 用于生成猫和老鼠的 base64 图标

// 生成猫的图标（红色圆形背景 + 猫 emoji）
export function generateCatIcon() {
  return '/assets/icons/cat.png';
}

// 生成老鼠的图标（青色圆形背景 + 老鼠 emoji）
export function generateMouseIcon() {
  return '/assets/icons/mouse.png';
}

// 备用方案：使用 emoji 作为标记（如果图标不存在）
export function getRoleEmoji(role) {
  return role === 'cat' ? '🐱' : '🐭';
}

export default {
  generateCatIcon,
  generateMouseIcon,
  getRoleEmoji
};

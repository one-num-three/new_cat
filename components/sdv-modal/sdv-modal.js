Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    visible: { type: Boolean, value: false },
    mode: { type: String, value: 'dialog' },
    title: { type: String, value: '' },
    content: { type: String, value: '' },
    confirmText: { type: String, value: '确认' },
    cancelText: { type: String, value: '取消' },
    showCancel: { type: Boolean, value: true },
    confirmTone: { type: String, value: 'green' },
    items: { type: Array, value: [] },
    fontScale: { type: Number, value: 1 }
  },
  methods: {
    ignoreTouch() {},
    onMaskTap() {
      this.triggerEvent('close');
    },
    onCancel() {
      this.triggerEvent('cancel');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },
    onSelectItem(e) {
      const index = Number(e.currentTarget.dataset.index);
      const item = (this.data.items || [])[index] || null;
      this.triggerEvent('select', {
        id: item && item.id !== undefined ? item.id : index,
        index,
        item
      });
    }
  }
});

import { EffectPreviewTooltip } from './EffectPreviewTooltip.js';
import { PREVIEW_CATEGORIES } from '../config/effectPreviews.js';

export class CustomSelect {
  constructor({
    options = [],
    value = '',
    placeholder = 'Select...',
    category = null,
    fieldName = '',
    className = 'inspector-input',
    onChange = () => {},
    enableSearch = true,
    groups = null
  }) {
    this.options = options;
    this.currentValue = value;
    this.placeholder = placeholder;
    this.category = category;
    this.fieldName = fieldName;
    this.className = className;
    this.onChange = onChange;
    this.enableSearch = enableSearch;
    this.isOpen = false;
    this.activeGroupTab = 'all';

    this.groups = groups || this._deriveGroups();
    this.hasGroups = Array.isArray(this.groups) && this.groups.length > 1;

    this.container = document.createElement('div');
    this.container.className = 'custom-select-container';
    this.container.dataset.fieldName = this.fieldName;
    this.container.style.cssText = `
      position: relative;
      width: 100%;
      user-select: none;
    `;

    this._buildUI();
    this._bindEvents();
  }

  get value() {
    return this.currentValue;
  }

  set value(val) {
    this.setValue(val, false);
  }

  get element() {
    return this.container;
  }

  setValue(val, triggerChange = true) {
    this.currentValue = val;
    this._updateTriggerLabel();
    this._highlightSelectedOption();

    if (triggerChange && typeof this.onChange === 'function') {
      this.onChange(val);
    }
  }

  _deriveGroups() {
    if (!Array.isArray(this.options)) return null;
    const groupSet = new Set();
    this.options.forEach((opt) => {
      if (opt && opt.group && opt.group !== 'all') {
        groupSet.add(opt.group);
      }
    });
    if (groupSet.size === 0) return null;
    return [
      { id: 'all', label: 'All' },
      ...Array.from(groupSet).map((g) => ({
        id: g,
        label: g === 'shell' ? 'Shell' : (g === 'comet' ? 'Comet' : g)
      }))
    ];
  }

  setActiveGroupTab(groupId) {
    this.activeGroupTab = groupId;
    if (this.tabButtons) {
      this.tabButtons.forEach((btn) => {
        const isSelected = btn.dataset.groupId === groupId;
        const isComet = btn.dataset.groupId === 'comet';
        btn.style.background = isSelected
          ? (isComet ? 'rgba(251, 191, 36, 0.22)' : 'rgba(56, 189, 248, 0.2)')
          : 'transparent';
        btn.style.color = isSelected
          ? (isComet ? '#fbbf24' : '#38bdf8')
          : '#94a3b8';
        btn.style.borderColor = isSelected
          ? (isComet ? 'rgba(251, 191, 36, 0.45)' : 'rgba(56, 189, 248, 0.45)')
          : 'transparent';
      });
    }
    const currentQuery = this.searchInput ? this.searchInput.value : '';
    this._renderOptionList(currentQuery);
  }

  setOptions(newOptions) {
    this.options = newOptions;
    if (!this.groups) {
      this.groups = this._deriveGroups();
      this.hasGroups = Array.isArray(this.groups) && this.groups.length > 1;
    }
    this._renderOptionList(this.searchInput ? this.searchInput.value : '');
    this._updateTriggerLabel();
  }

  _buildUI() {
    // 1. Trigger Button
    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = `custom-select-trigger ${this.className}`;
    this.trigger.style.cssText = `
      width: 100%;
      padding: 6px 10px;
      background: #101418;
      border: 1px solid #2c3e50;
      color: #fff;
      font-family: inherit;
      font-size: 12px;
      border-radius: 4px;
      box-sizing: border-box;
      outline: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
      gap: 6px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    `;

    this.triggerText = document.createElement('span');
    this.triggerText.style.cssText = `
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    `;

    this.triggerArrow = document.createElement('span');
    this.triggerArrow.textContent = '▼';
    this.triggerArrow.style.cssText = `
      font-size: 9px;
      color: #94a3b8;
      transition: transform 0.2s ease;
      flex-shrink: 0;
    `;

    this.trigger.appendChild(this.triggerText);
    this.trigger.appendChild(this.triggerArrow);
    this.container.appendChild(this.trigger);

    // 2. Dropdown Menu
    this.menu = document.createElement('div');
    this.menu.className = 'custom-select-menu';
    if (!this.menu.dataset) {
      this.menu.dataset = {};
    }
    this.menu.dataset.fieldName = this.fieldName;
    this.menu.style.cssText = `
      position: fixed;
      display: none;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      z-index: 100018;
      max-height: 280px;
      overflow-y: auto;
      min-width: 180px;
      box-sizing: border-box;
      padding: 4px;
    `;

    // Group filter tabs
    if (this.hasGroups && this.groups.length > 1) {
      this.tabsContainer = document.createElement('div');
      this.tabsContainer.className = 'custom-select-tabs';
      this.tabsContainer.style.cssText = `
        display: flex;
        gap: 3px;
        padding: 4px;
        margin-bottom: 4px;
        border-bottom: 1px solid #1e293b;
        background: #090d16;
        border-radius: 4px;
      `;

      this.tabButtons = [];
      this.groups.forEach((group) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'custom-select-tab-btn';
        tabBtn.dataset.groupId = group.id;
        tabBtn.textContent = group.label || group.id;
        const isSelected = group.id === this.activeGroupTab;
        const isComet = group.id === 'comet';
        tabBtn.style.cssText = `
          flex: 1;
          padding: 3px 6px;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          border-radius: 4px;
          cursor: pointer;
          border: 1px solid transparent;
          text-align: center;
          transition: all 0.15s ease;
          background: ${isSelected ? (isComet ? 'rgba(251, 191, 36, 0.22)' : 'rgba(56, 189, 248, 0.2)') : 'transparent'};
          color: ${isSelected ? (isComet ? '#fbbf24' : '#38bdf8') : '#94a3b8'};
          border-color: ${isSelected ? (isComet ? 'rgba(251, 191, 36, 0.45)' : 'rgba(56, 189, 248, 0.45)') : 'transparent'};
        `;

        tabBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.setActiveGroupTab(group.id);
        });

        this.tabButtons.push(tabBtn);
        this.tabsContainer.appendChild(tabBtn);
      });

      this.menu.appendChild(this.tabsContainer);
    }

    // Search input for long lists (> 6 items)
    if (this.enableSearch && this.options.length > 6) {
      this.searchWrapper = document.createElement('div');
      this.searchWrapper.style.cssText = `
        padding: 4px;
        position: sticky;
        top: 0;
        background: #0f172a;
        z-index: 2;
        border-bottom: 1px solid #1e293b;
        margin-bottom: 4px;
      `;

      this.searchInput = document.createElement('input');
      this.searchInput.type = 'text';
      this.searchInput.placeholder = 'Search...';
      this.searchInput.style.cssText = `
        width: 100%;
        padding: 4px 8px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #f8fafc;
        font-size: 11px;
        outline: none;
        box-sizing: border-box;
      `;

      this.searchInput.addEventListener('input', (e) => {
        this._filterOptions(e.target.value);
      });

      this.searchWrapper.appendChild(this.searchInput);
      this.menu.appendChild(this.searchWrapper);
    }

    this.optionsList = document.createElement('div');
    this.optionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;
    this.menu.appendChild(this.optionsList);

    document.body.appendChild(this.menu);
    this._renderOptionList();
    this._updateTriggerLabel();
  }

  _renderOptionList(filterText = '') {
    this.optionsList.innerHTML = '';
    if (Array.isArray(this.optionsList.children)) {
      this.optionsList.children = [];
    }
    const query = filterText.toLowerCase().trim();

    const filtered = this.options.filter(opt => {
      const label = typeof opt === 'string' ? opt : (opt.label || opt.value || '');
      const matchesQuery = !query || label.toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (!this.hasGroups || !this.activeGroupTab || this.activeGroupTab === 'all') return true;
      if (!opt.group || opt.group === 'all') return true;
      return opt.group === this.activeGroupTab;
    });

    if (filtered.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.textContent = 'No matching options';
      emptyItem.style.cssText = `
        padding: 8px 10px;
        font-size: 11px;
        color: #64748b;
        text-align: center;
      `;
      this.optionsList.appendChild(emptyItem);
      return;
    }

    let currentGroup = null;
    filtered.forEach(opt => {
      const optVal = typeof opt === 'string' ? opt : opt.value;
      const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
      const optGroup = typeof opt === 'object' && opt !== null ? opt.group : null;

      if (
        this.hasGroups &&
        (!this.activeGroupTab || this.activeGroupTab === 'all') &&
        optGroup &&
        optGroup !== 'all' &&
        optGroup !== currentGroup
      ) {
        currentGroup = optGroup;
        const header = document.createElement('div');
        header.className = 'custom-select-group-header';
        header.dataset.group = optGroup;
        header.textContent = opt.groupLabel || (optGroup === 'shell' ? 'Shell Presets' : (optGroup === 'comet' ? 'Comet Presets' : optGroup));
        const isCometGroup = optGroup === 'comet';
        header.style.cssText = `
          padding: 6px 10px 4px 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: ${isCometGroup ? '#fbbf24' : '#38bdf8'};
          border-bottom: 1px solid ${isCometGroup ? 'rgba(251, 191, 36, 0.2)' : 'rgba(56, 189, 248, 0.2)'};
          margin-top: 6px;
          margin-bottom: 2px;
          pointer-events: none;
          user-select: none;
        `;
        this.optionsList.appendChild(header);
      }

      const item = document.createElement('div');
      item.className = 'custom-select-item';
      item.dataset.value = optVal;
      if (optGroup) {
        item.dataset.group = optGroup;
      }
      item.style.cssText = `
        padding: 6px 10px;
        font-size: 12px;
        color: ${optVal === this.currentValue ? '#38bdf8' : '#e2e8f0'};
        background: ${optVal === this.currentValue ? '#1e293b' : 'transparent'};
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        transition: background 0.12s ease, color 0.12s ease;
      `;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = optLabel;
      item.appendChild(labelSpan);

      if (optVal === this.currentValue) {
        const check = document.createElement('span');
        check.textContent = '✓';
        check.style.fontSize = '11px';
        check.style.color = '#38bdf8';
        item.appendChild(check);
      }

      // Live Hover Preview
      item.addEventListener('mouseenter', (e) => {
        item.style.background = '#1e293b';
        item.style.color = '#f8fafc';

        if (this.category && optVal) {
          EffectPreviewTooltip.getInstance().show(
            optVal,
            this.category,
            e.clientX,
            e.clientY,
            item
          );
        }
      });

      item.addEventListener('mouseleave', () => {
        if (optVal !== this.currentValue) {
          item.style.background = 'transparent';
          item.style.color = '#e2e8f0';
        } else {
          item.style.background = '#1e293b';
          item.style.color = '#38bdf8';
        }
        EffectPreviewTooltip.getInstance().hide();
      });

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setValue(optVal, true);
        this.close();
        EffectPreviewTooltip.getInstance().hide();
      });

      this.optionsList.appendChild(item);
    });
  }

  _filterOptions(query) {
    this._renderOptionList(query);
  }

  _updateTriggerLabel() {
    const selected = this.options.find(opt => {
      const val = typeof opt === 'string' ? opt : opt.value;
      return val === this.currentValue;
    });

    if (selected) {
      this.triggerText.textContent = typeof selected === 'string'
        ? selected
        : (selected.label || selected.value);
    } else {
      this.triggerText.textContent = this.placeholder;
    }
  }

  _highlightSelectedOption() {
    const items = this.optionsList.querySelectorAll('.custom-select-item');
    items.forEach(item => {
      if (item.dataset.value === this.currentValue) {
        item.style.background = '#1e293b';
        item.style.color = '#38bdf8';
      } else {
        item.style.background = 'transparent';
        item.style.color = '#e2e8f0';
      }
    });
  }

  _bindEvents() {
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.trigger.addEventListener('mouseenter', (e) => {
      if (!this.isOpen && this.category && this.currentValue) {
        EffectPreviewTooltip.getInstance().show(
          this.currentValue,
          this.category,
          e.clientX,
          e.clientY,
          this.trigger
        );
      }
    });

    this.trigger.addEventListener('mouseleave', () => {
      if (!this.isOpen) {
        EffectPreviewTooltip.getInstance().hide();
      }
    });

    // Close on outside click or window resize/scroll
    this._onDocumentClick = (e) => {
      if (this.isOpen && !this.container.contains(e.target) && !this.menu.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener('click', this._onDocumentClick);

    this._onScrollOrResize = () => {
      if (this.isOpen) {
        this._updateMenuPosition();
      }
    };
    window.addEventListener('resize', this._onScrollOrResize, true);
    window.addEventListener('scroll', this._onScrollOrResize, true);
  }

  _updateMenuPosition() {
    if (!this.isOpen || !this.trigger) return;

    const rect = this.trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 220);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top, left;
    left = Math.min(rect.left, window.innerWidth - menuWidth - 10);
    left = Math.max(10, left);

    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      // Open upwards
      top = Math.max(10, rect.top - Math.min(280, spaceAbove - 10));
      this.menu.style.maxHeight = `${spaceAbove - 20}px`;
    } else {
      // Open downwards
      top = rect.bottom + 4;
      this.menu.style.maxHeight = `${Math.min(280, spaceBelow - 20)}px`;
    }

    this.menu.style.top = `${top}px`;
    this.menu.style.left = `${left}px`;
    this.menu.style.width = `${menuWidth}px`;
  }

  open() {
    if (this.isOpen) return;

    // Close any other open custom selects
    document.querySelectorAll('.custom-select-menu').forEach(menu => {
      menu.style.display = 'none';
    });

    this.isOpen = true;
    this.menu.style.display = 'block';
    this.triggerArrow.style.transform = 'rotate(180deg)';
    this.trigger.style.borderColor = '#38bdf8';
    this.trigger.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.2)';

    this._updateMenuPosition();

    if (this.searchInput) {
      this.searchInput.value = '';
      this._renderOptionList('');
      setTimeout(() => this.searchInput.focus(), 30);
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.menu.style.display = 'none';
    this.triggerArrow.style.transform = 'rotate(0deg)';
    this.trigger.style.borderColor = '#2c3e50';
    this.trigger.style.boxShadow = 'none';
    EffectPreviewTooltip.getInstance().hide();
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy() {
    document.removeEventListener('click', this._onDocumentClick);
    window.removeEventListener('resize', this._onScrollOrResize, true);
    window.removeEventListener('scroll', this._onScrollOrResize, true);
    if (this.menu && this.menu.parentElement) {
      this.menu.parentElement.removeChild(this.menu);
    }
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

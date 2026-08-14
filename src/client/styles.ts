/**
 * Global MuseAI stylesheet (a trimmed subset of MuseAI's App.css) plus the
 * idempotent injection helper. The plugin ships plain CSS as an embedded
 * string — the browser bundle inlines it and a plugin-owned <style> tag is
 * installed once per page load.
 * @module @yejiming/dsh-museai-tavern/client/styles
 */

/** Plain CSS text injected once by {@link injectMuseaiStyles}. */
export const MUSAI_CSS = `
.museai-view-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #faf9f5;
  color: #33312e;
}
.museai-view-root .museai-tabs {
  flex: none;
  padding: 0 16px;
  background: #faf9f5;
  border-bottom: 1px solid #ece7df;
}
.museai-view-root .museai-tabs .ant-tabs-nav {
  margin-bottom: 0;
}
.museai-view-root .museai-tabs .ant-tabs-tab {
  padding: 10px 4px;
}
.museai-view-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.museai-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9c968c;
  font-size: 14px;
}
/* Bond page (ported from MuseAI App.css). */
.bond-page {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #faf9f5;
}
.bond-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}
.bond-directory-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  color: #33312e;
  cursor: pointer;
  transition: background-color 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), color 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
}
.bond-directory-item:hover {
  background-color: #faf6f0;
}
.bond-directory-item.is-selected {
  background: #f2e8dc;
  color: #d97757;
}
.bond-directory-item__name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bond-directory-item.is-selected .bond-directory-item__name {
  font-weight: 500;
}
.bond-character-tree .ant-tree-node-content-wrapper {
  padding: 0;
}
.bond-character-tree .ant-tree-node-content-wrapper.ant-tree-node-selected {
  background: transparent;
}
.bond-character-tree .ant-tree-treenode {
  padding: 1px 0;
}
/* Form/card classes shared by the Bond cards (from MuseAI Background inline styles). */
.input-label {
  font-size: 12px;
  color: #8c8882;
  font-weight: 500;
  margin-bottom: 6px;
}
.form-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #33312e;
  display: flex;
  align-items: center;
  gap: 8px;
}
.custom-form-card {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.03) !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01) !important;
}
.custom-form-card .ant-card-head {
  border-bottom: 1px solid rgba(0, 0, 0, 0.02) !important;
  background: #fafafa !important;
  border-top-left-radius: 8px !important;
  border-top-right-radius: 8px !important;
}
/* Hide the platform composer seat while the MuseAI view is active. */
.museai-view-active [data-composer-seat] {
  display: none !important;
}
`.trim()

/** Install the MuseAI stylesheet once; idempotent across view remounts. */
export function injectMuseaiStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-plugin-css="museai-global"]') !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = '@yejiming/dsh-museai-tavern'
  tag.dataset.pluginCss = 'museai-global'
  tag.textContent = MUSAI_CSS
  document.head.appendChild(tag)
}

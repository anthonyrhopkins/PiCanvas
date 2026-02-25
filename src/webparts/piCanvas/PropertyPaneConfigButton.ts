/**
 * PropertyPaneConfigButton — Custom property pane field that renders a
 * prominent "Open Configuration Panel" button.
 * Same pattern as PropertyPaneTabPreview.ts.
 */
import {
  IPropertyPaneCustomFieldProps,
  IPropertyPaneField,
  PropertyPaneFieldType
} from '@microsoft/sp-property-pane';

export interface IPropertyPaneConfigButtonProps {
  onClick: () => void;
}

interface IPropertyPaneConfigButtonInternalProps extends IPropertyPaneConfigButtonProps, IPropertyPaneCustomFieldProps {
}

class PropertyPaneConfigButtonBuilder implements IPropertyPaneField<IPropertyPaneConfigButtonProps> {
  public type: PropertyPaneFieldType = PropertyPaneFieldType.Custom;
  public targetProperty: string;
  public properties: IPropertyPaneConfigButtonInternalProps;

  constructor(targetProperty: string, properties: IPropertyPaneConfigButtonProps) {
    this.targetProperty = targetProperty;
    this.properties = {
      ...properties,
      key: 'configPanelButton',
      onRender: this.onRender.bind(this)
    };
  }

  private onRender(elem: HTMLElement): void {
    const props = this.properties;

    elem.innerHTML = `
      <div style="
        margin: 0 0 16px 0;
        padding: 0;
      ">
        <button type="button" style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, #0078d4 0%, #106ebe 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 120, 212, 0.3);
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        " class="picanvas-config-open-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0;">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="white" stroke-width="1.5" fill="none"/>
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="white" stroke-width="1.5" fill="none"/>
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="white" stroke-width="1.5" fill="none"/>
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="white" stroke-width="1.5" fill="none"/>
          </svg>
          Open Configuration Panel
        </button>
        <div style="
          font-size: 11px;
          color: #666;
          text-align: center;
          margin-top: 8px;
          line-height: 1.3;
        ">Full-screen editor with visual controls, live preview, and drag-and-drop tab management.</div>
      </div>
    `;

    const btn = elem.querySelector('.picanvas-config-open-btn') as HTMLElement;
    if (btn) {
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'linear-gradient(135deg, #106ebe 0%, #0062a3 100%)';
        btn.style.boxShadow = '0 4px 12px rgba(0, 120, 212, 0.4)';
        btn.style.transform = 'translateY(-1px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'linear-gradient(135deg, #0078d4 0%, #106ebe 100%)';
        btn.style.boxShadow = '0 2px 6px rgba(0, 120, 212, 0.3)';
        btn.style.transform = 'translateY(0)';
      });
      btn.addEventListener('click', () => {
        props.onClick();
      });
    }
  }
}

export function PropertyPaneConfigButton(targetProperty: string, properties: IPropertyPaneConfigButtonProps): IPropertyPaneField<IPropertyPaneConfigButtonProps> {
  return new PropertyPaneConfigButtonBuilder(targetProperty, properties);
}

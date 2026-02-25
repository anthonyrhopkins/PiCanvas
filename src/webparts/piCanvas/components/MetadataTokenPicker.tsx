/**
 * MetadataTokenPicker Component
 * A property pane component that displays available page metadata tokens
 * organized by category with copy-to-clipboard functionality
 */

import * as React from 'react';
import {
  IResolvedToken,
  MetadataTokenCategory,
  TOKEN_CATEGORY_INFO,
  getTokenSyntax
} from '../models/MetadataTokenModels';
import styles from './MetadataTokenPicker.module.scss';

export interface IMetadataTokenPickerProps {
  /** Tokens organized by category */
  tokensByCategory: Record<MetadataTokenCategory, IResolvedToken[]>;
  /** Whether tokens are still loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error?: string;
  /** Callback when a token is copied */
  onTokenCopied?: (token: IResolvedToken) => void;
  /** Label for the component */
  label?: string;
}

interface IMetadataTokenPickerState {
  expandedCategories: Set<MetadataTokenCategory>;
  copiedTokenId: string | null;
  searchQuery: string;
}

export class MetadataTokenPicker extends React.Component<IMetadataTokenPickerProps, IMetadataTokenPickerState> {
  private copyTimeoutId: number | null = null;

  constructor(props: IMetadataTokenPickerProps) {
    super(props);
    this.state = {
      expandedCategories: new Set(['page', 'people', 'dates']),
      copiedTokenId: null,
      searchQuery: ''
    };
  }

  public componentWillUnmount(): void {
    if (this.copyTimeoutId) {
      window.clearTimeout(this.copyTimeoutId);
    }
  }

  private toggleCategory = (category: MetadataTokenCategory): void => {
    this.setState(prevState => {
      const expanded = new Set(prevState.expandedCategories);
      if (expanded.has(category)) {
        expanded.delete(category);
      } else {
        expanded.add(category);
      }
      return { expandedCategories: expanded };
    });
  };

  private copyToken = async (token: IResolvedToken): Promise<void> => {
    const tokenSyntax = getTokenSyntax(token);

    try {
      await navigator.clipboard.writeText(tokenSyntax);
      this.setState({ copiedTokenId: token.id });

      // Clear the copied state after 2 seconds
      if (this.copyTimeoutId) {
        window.clearTimeout(this.copyTimeoutId);
      }
      this.copyTimeoutId = window.setTimeout(() => {
        this.setState({ copiedTokenId: null });
      }, 2000);

      if (this.props.onTokenCopied) {
        this.props.onTokenCopied(token);
      }
    } catch (error) {
      console.error('[PiCanvas] Failed to copy token:', error);
    }
  };

  private handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ searchQuery: event.target.value });
  };

  private filterTokens(tokens: IResolvedToken[]): IResolvedToken[] {
    const { searchQuery } = this.state;
    if (!searchQuery.trim()) {
      return tokens;
    }

    const query = searchQuery.toLowerCase();
    return tokens.filter(token =>
      token.label.toLowerCase().includes(query) ||
      token.valuePath.toLowerCase().includes(query) ||
      token.description.toLowerCase().includes(query) ||
      (token.currentValue && token.currentValue.toLowerCase().includes(query))
    );
  }

  private renderToken(token: IResolvedToken): JSX.Element {
    const { copiedTokenId } = this.state;
    const isCopied = copiedTokenId === token.id;
    const tokenSyntax = getTokenSyntax(token);

    return (
      <div
        key={token.id}
        className={`${styles.tokenItem} ${!token.hasValue ? styles.tokenItemNoValue : ''}`}
        onClick={() => this.copyToken(token)}
        title={`Click to copy: ${tokenSyntax}`}
      >
        <div className={styles.tokenInfo}>
          <div className={styles.tokenLabel}>{token.label}</div>
          <div className={styles.tokenPath}>{tokenSyntax}</div>
          {token.hasValue && token.currentValue && (
            <div className={styles.tokenValue} title={token.currentValue}>
              {token.currentValue.length > 50
                ? token.currentValue.substring(0, 50) + '...'
                : token.currentValue}
            </div>
          )}
        </div>
        <button
          className={`${styles.copyButton} ${isCopied ? styles.copyButtonCopied : ''}`}
          onClick={(e) => { e.stopPropagation(); this.copyToken(token); }}
          title={isCopied ? 'Copied!' : 'Copy to clipboard'}
          aria-label={isCopied ? 'Copied!' : `Copy ${token.label} token`}
        >
          {isCopied ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
            </svg>
          )}
        </button>
      </div>
    );
  }

  private renderCategory(category: MetadataTokenCategory): JSX.Element | null {
    const { tokensByCategory } = this.props;
    const { expandedCategories } = this.state;

    const tokens = tokensByCategory[category] || [];
    const filteredTokens = this.filterTokens(tokens);

    // Don't render empty categories
    if (filteredTokens.length === 0) {
      return null;
    }

    const isExpanded = expandedCategories.has(category);
    const categoryInfo = TOKEN_CATEGORY_INFO[category];

    return (
      <div key={category} className={styles.category}>
        <button
          className={styles.categoryHeader}
          onClick={() => this.toggleCategory(category)}
          aria-expanded={isExpanded}
        >
          <span className={styles.categoryIcon}>
            {this.getCategoryIcon(category)}
          </span>
          <span className={styles.categoryLabel}>{categoryInfo.label}</span>
          <span className={styles.categoryCount}>{filteredTokens.length}</span>
          <span className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
        {isExpanded && (
          <div className={styles.categoryContent}>
            {filteredTokens.map(token => this.renderToken(token))}
          </div>
        )}
      </div>
    );
  }

  private getCategoryIcon(category: MetadataTokenCategory): JSX.Element {
    const icons: Record<MetadataTokenCategory, JSX.Element> = {
      page: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
        </svg>
      ),
      people: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1h8zm-7.978-1A.261.261 0 0 1 7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002a.274.274 0 0 1-.014.002H7.022zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM6.936 9.28a5.88 5.88 0 0 0-1.23-.247A7.35 7.35 0 0 0 5 9c-4 0-5 3-5 4 0 .667.333 1 1 1h4.216A2.238 2.238 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816zM4.92 10A5.493 5.493 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275zM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0zm3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
        </svg>
      ),
      dates: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/>
        </svg>
      ),
      site: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
        </svg>
      ),
      custom: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586V2zm3.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
        </svg>
      )
    };
    return icons[category];
  }

  public render(): JSX.Element {
    const { isLoading, error, label } = this.props;
    const { searchQuery } = this.state;

    if (error) {
      return (
        <div className={styles.container}>
          <div className={styles.error}>
            <span className={styles.errorIcon}>!</span>
            <span>{error}</span>
          </div>
        </div>
      );
    }

    const categories: MetadataTokenCategory[] = ['page', 'people', 'dates', 'site', 'custom'];

    return (
      <div className={styles.container}>
        {label && <div className={styles.label}>{label}</div>}

        <div className={styles.searchContainer}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search tokens..."
            value={searchQuery}
            onChange={this.handleSearchChange}
            aria-label="Search tokens"
          />
          {searchQuery && (
            <button
              className={styles.clearSearch}
              onClick={() => this.setState({ searchQuery: '' })}
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <span>Loading tokens...</span>
          </div>
        ) : (
          <div className={styles.categories}>
            {categories.map(category => this.renderCategory(category))}
          </div>
        )}

        <div className={styles.helpText}>
          Click a token to copy. Paste <code>{'{{Token}}'}</code> in your content.
        </div>
      </div>
    );
  }
}

export default MetadataTokenPicker;

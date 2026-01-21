declare interface IPiCanvasWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  DescriptionFieldLabel: string;
  SectionClass: string;
  WebPartClass: string;
  TabLabels: string;
  ManageTabLabels: string;
  AppTitle: string;
  OriginalAuthor: string;
  UpgradedBy: string;

  // Template strings
  TemplatesGroupName: string;
  TemplatesDescription: string;
  ApplyTemplateLabel: string;
  SelectTemplatePlaceholder: string;
  BuiltInTemplatesHeader: string;
  SavedTemplatesHeader: string;
  ApplyTemplateButton: string;
  ExportImportHeader: string;
  ExportConfigLabel: string;
  ImportConfigLabel: string;
  SaveAsTemplateLabel: string;
  TemplateNamePrompt: string;
  ExportSuccessMessage: string;
  ImportSuccessMessage: string;
  SaveTemplateSuccessMessage: string;
  ImportErrorMessage: string;
  SaveTemplateErrorMessage: string;
  NoSiteAssetsAccess: string;

  // Permission strings
  PermissionHeaderLabel: string;
  PermissionEnabledLabel: string;
  PermissionGroupsLabel: string;
  PermissionGroupsDescription: string;
  PermissionCustomGroupsLabel: string;
  PermissionCustomGroupsPlaceholder: string;
  PermissionCustomGroupsDescription: string;
  PermissionVisibleToAll: string;
  PermissionOwnersLabel: string;
  PermissionMembersLabel: string;
  PermissionVisitorsLabel: string;
  PermissionOwnersMembers: string;
  PermissionMembersVisitors: string;
  PermissionAllGroups: string;

  // Permission placeholder strings
  PermissionPlaceholderLabel: string;
  PermissionPlaceholderDescription: string;
  PermissionPlaceholderTextLabel: string;
  PermissionPlaceholderTextPlaceholder: string;
  PermissionPlaceholderDefault: string;

  // Lock strings
  LockHeaderLabel: string;
  LockEnabledLabel: string;
  LockEnabledOnText: string;
  LockEnabledOffText: string;
  LockPasswordSetLabel: string;
  LockPasswordMissingLabel: string;
  LockPasswordLabel: string;
  LockPasswordDescription: string;
  LockTemplateToggleLabel: string;
  LockTemplateToggleOnText: string;
  LockTemplateToggleOffText: string;
  LockTemplateLabel: string;
  LockTemplateDescription: string;
  LockMessagesToggleLabel: string;
  LockMessagesToggleOnText: string;
  LockMessagesToggleOffText: string;
  LockPromptMessageLabel: string;
  LockPromptMessageDescription: string;
  LockErrorMessageLabel: string;
  LockErrorMessageDescription: string;
  LockMissingPasswordMessageLabel: string;
  LockMissingPasswordMessageDescription: string;
  LockSuccessMessageLabel: string;
  LockSuccessMessageDescription: string;
  LockPromptMessage: string;
  LockErrorMessage: string;
  LockMissingPasswordMessage: string;
  LockSuccessMessage: string;
  LockTitleText: string;
  LockPasswordFieldLabel: string;
  LockUnlockButtonLabel: string;

  // Lock default strings
  LockDefaultsGroupName: string;
  LockDefaultsDescription: string;
  LockUnlockTtlLabel: string;
  LockUnlockTtlDescription: string;
  LockDefaultTemplateToggleLabel: string;
  LockDefaultTemplateToggleOnText: string;
  LockDefaultTemplateToggleOffText: string;
  LockDefaultTemplateLabel: string;
  LockDefaultTemplateDescription: string;
  LockDefaultMessagesToggleLabel: string;
  LockDefaultMessagesToggleOnText: string;
  LockDefaultMessagesToggleOffText: string;
  LockDefaultPromptMessageLabel: string;
  LockDefaultPromptMessageDescription: string;
  LockDefaultErrorMessageLabel: string;
  LockDefaultErrorMessageDescription: string;
  LockDefaultMissingMessageLabel: string;
  LockDefaultMissingMessageDescription: string;
  LockDefaultSuccessMessageLabel: string;
  LockDefaultSuccessMessageDescription: string;

  // Content type strings (v3.0)
  ContentTypeLabel: string;
  ContentTypeWebPart: string;
  ContentTypeSection: string;
  ContentTypeMarkdown: string;
  ContentTypeHtml: string;
  ContentTypeMermaid: string;
  ContentTypeEmbed: string;

  // Custom content strings (v3.0)
  CustomContentLabel: string;
  MarkdownPlaceholder: string;
  HtmlPlaceholder: string;
  MermaidPlaceholder: string;

  // Embed strings (v3.0)
  EmbedUrlLabel: string;
  EmbedUrlDescription: string;
  EmbedHeightLabel: string;
  EmbedHeightPlaceholder: string;
  EmbedFullPageLabel: string;
  EmbedFullPageOn: string;
  EmbedFullPageOff: string;
  EmbedFullWidthLabel: string;
  EmbedFullWidthOn: string;
  EmbedFullWidthOff: string;
  EmbedFullHeightLabel: string;
  EmbedFullHeightOn: string;
  EmbedFullHeightOff: string;

  // External file strings (v3.1)
  ContentTypeFile: string;
  FileUrlLabel: string;
  FileUrlPlaceholder: string;
  FileUrlDescription: string;
  BrowseSiteAssetsLabel: string;
  FileLoadingMessage: string;
  FileUrlMissingMessage: string;
  FileTypeUnsupportedMessage: string;
  FileSourceWebPartMissingMessage: string;
  FileSourceWebPartEmptyMessage: string;

  // Content source strings (v3.1)
  ContentSourceTypeLabel: string;
  ContentSourceManual: string;
  ContentSourceWebPart: string;
  ContentSourceWebPartLabel: string;
  ContentSourceWebPartInfo: string;

  // RSS Feed strings (v3.2)
  ContentTypeRss: string;
  RssFeedUrlLabel: string;
  RssLayoutLabel: string;
  RssMaxItemsLabel: string;
  RssShowDateLabel: string;
  RssShowDescriptionLabel: string;
  RssShowImageLabel: string;
  RssShowAuthorLabel: string;
  RssDescriptionLimitLabel: string;
  RssDateFormatLabel: string;
  RssLinkTargetLabel: string;
  RssLoadingMessageLabel: string;

  // Feature toggle strings (v3.0)
  EnableDeepLinkingLabel: string;
  EnableDeepLinkingDescription: string;
  EnableLazyLoadingLabel: string;
  EnableLazyLoadingDescription: string;

  // Accessibility strings (v3.0)
  TabListAriaLabel: string;
}

declare module 'PiCanvasWebPartStrings' {
  const strings: IPiCanvasWebPartStrings;
  export = strings;
}

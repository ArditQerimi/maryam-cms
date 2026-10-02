import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart3,
  BookOpen,
  Columns3,
  Grid2x2,
  Image as ImageIcon,
  LayoutTemplate,
  Minus,
  Images,
  MousePointerClick,
  MessageSquareQuote,
  Newspaper,
  PackageSearch,
  Plus,
  Sparkles,
  Tag,
  Type,
  HelpCircle,
  Megaphone,
  Code2,
  Heading1,
} from 'lucide-react';

export type BlockType =
  | 'columns_2'
  | 'columns_3'
  | 'columns_4'
  | 'spacer'
  | 'heading'
  | 'paragraph'
  | 'button'
  | 'badge'
  | 'html'
  | 'image'
  | 'gallery'
  | 'product_grid'
  | 'hero'
  | 'hero_carousel'
  | 'cta'
  | 'faq'
  | 'testimonial'
  /* Storefront sections — rendered by `/home` with live catalogue data. */
  | 'store_products'
  | 'store_categories'
  | 'store_stats'
  | 'store_about'
  | 'store_deal'
  | 'store_story'
  | 'store_mind'
  | 'store_blog'
  | 'store_widgets';

export type BlockProps = Record<string, any>;

/** Structural node kinds the layout tree is built from. */
export type LayoutType = 'row' | 'column';
export type NodeType = BlockType | LayoutType;
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';
/** Per-breakpoint overrides, merged over `props` while that breakpoint is active. */
export type Responsive<T = BlockProps> = Partial<Record<Breakpoint, Partial<T>>>;

export type Block = {
  id: string;
  type: NodeType;
  props: BlockProps;
  children?: Block[];
  responsive?: Responsive;
};

/** Row/column container nodes carry no module-specific icon. */
export const LAYOUT_TYPES: LayoutType[] = ['row', 'column'];

/** Settings-panel tab a field belongs to (defaults to General). */
export type FieldTab = 'general' | 'style' | 'advanced';

export type FieldDef = { tab?: FieldTab } & (
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'link'; key: string; label: string; placeholder?: string }
  | { kind: 'textarea'; key: string; label: string; rows?: number; placeholder?: string }
  | { kind: 'richtext'; key: string; label: string }
  | { kind: 'number'; key: string; label: string; min?: number; max?: number; step?: number }
  | { kind: 'select'; key: string; label: string; options: Array<{ value: string | number; label: string }> }
  | { kind: 'color'; key: string; label: string }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'range'; key: string; label: string; min: number; max: number; step?: number; unit?: string }
  | { kind: 'image'; key: string; label: string }
  | { kind: 'images'; key: string; label: string }
  | { kind: 'products'; key: string; label: string }
  | { kind: 'heading'; key: string; label: string }
  | { kind: 'alignment'; key: string; label: string }
  | { kind: 'columns'; key: string; label: string }
  | { kind: 'spacing'; key: string; label: string }
  | { kind: 'productSource'; key: string; label: string }
  /** Single category picker, filled from the live catalogue. */
  | { kind: 'category'; key: string; label: string }
  | {
      kind: 'items';
      key: string;
      label: string;
      itemLabel: string;
      addLabel: string;
      fields: FieldDef[];
    }
  /** Four-sided spacing editor (`{top,right,bottom,left}` in px). */
  | { kind: 'box'; key: string; label: string });

export type BlockGroup =
  | 'layout'
  | 'content'
  | 'media'
  | 'commerce'
  | 'marketing'
  | 'storefront';

export type BlockDef = {
  type: NodeType;
  label: string;
  group: BlockGroup;
  groupLabel: string;
  icon: typeof Plus;
  accent: string;
  description?: string;
  defaultProps: () => BlockProps;
  fields: FieldDef[];
  hasChildren?: boolean;
  childTypes?: NodeType[];
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: 'full' | 'half' | 'third' | 'twoThirds' | 'quarter';
};

export const BLOCK_GROUPS: Array<{ id: BlockGroup; label: string }> = [
  { id: 'layout', label: 'Layout' },
  { id: 'content', label: 'Content' },
  { id: 'media', label: 'Media' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'storefront', label: 'Storefront sections' },
];

const WIDTH_OPTIONS = [
  { value: 'full', label: 'Full width' },
  { value: 'twoThirds', label: 'Two thirds' },
  { value: 'half', label: 'Half width' },
  { value: 'third', label: 'One third' },
  { value: 'quarter', label: 'One quarter' },
];

const ALIGN_FIELD: FieldDef = {
  kind: 'alignment',
  key: 'align',
  label: 'Alignment',
};

const SPACING_FIELD: FieldDef = { kind: 'spacing', key: 'padding', label: 'Section spacing' };

const widthField = (): FieldDef => ({
  kind: 'select',
  key: 'width',
  label: 'Width',
  options: WIDTH_OPTIONS,
});

/* ------------------------------------------------------------ layout nodes */

const VALIGN_OPTIONS = [
  { value: 'stretch', label: 'Stretch to fit' },
  { value: 'flex-start', label: 'Top' },
  { value: 'center', label: 'Middle' },
  { value: 'flex-end', label: 'Bottom' },
];

/** Row = a horizontal band; the skeleton every page is built from. */
export const DEFAULT_ROW_PROPS: BlockProps = {
  contentWidth: 'full',
  maxWidth: 1280,
  height: 'auto',
  heightPx: 420,
  valign: 'stretch',
  gap: 24,
  layout: 'columns',
  slidesPerView: 1,
  autoplay: false,
  intervalSeconds: 5,
  arrows: true,
  dots: true,
  backgroundType: 'none',
  backgroundColor: '#ffffff',
  backgroundImage: '',
  backgroundVideo: '',
  overlayColor: '#000000',
  overlayOpacity: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  borderWidth: 0,
  borderStyle: 'solid',
  borderColor: '#e4e4e7',
  radius: 0,
  shadow: 'none',
  visibility: { desktop: true, tablet: true, mobile: true },
  cssId: '',
  cssClass: '',
};

/** Column = a vertical slice inside a row; holds modules and nested rows. */
export const DEFAULT_COLUMN_PROPS: BlockProps = {
  width: 50,
  valign: 'stretch',
  gap: 24,
  backgroundColor: 'transparent',
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  borderWidth: 0,
  borderStyle: 'solid',
  borderColor: 'transparent',
  radius: 0,
  reverseOnMobile: false,
  stackOrder: 'natural',
  cssClass: '',
};

const BOX_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** Deep clone for default props so two nodes never share a nested object. */
function cloneProps<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Spacing objects are merged side-by-side so partial stored values never crash. */
function normalizeBox(value: unknown, fallback: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...fallback };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const side of BOX_SIDES) {
      const raw = (value as Record<string, unknown>)[side];
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(num)) out[side] = num;
    }
  }
  return out;
}

const ROW_FIELDS: FieldDef[] = [
  {
    kind: 'select',
    key: 'contentWidth',
    label: 'Content width',
    tab: 'general',
    options: [
      { value: 'full', label: 'Full width' },
      { value: 'fixed', label: 'Boxed (max width)' },
    ],
  },
  { kind: 'number', key: 'maxWidth', label: 'Max content width (px)', tab: 'general', min: 320, max: 2560, step: 10 },
  {
    kind: 'select',
    key: 'height',
    label: 'Row height',
    tab: 'general',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'fixed', label: 'Fixed' },
      { value: 'full', label: 'Full screen' },
    ],
  },
  { kind: 'number', key: 'heightPx', label: 'Fixed height (px)', tab: 'general', min: 60, max: 3000, step: 10 },
  { kind: 'select', key: 'valign', label: 'Vertical alignment', tab: 'general', options: VALIGN_OPTIONS },
  { kind: 'number', key: 'gap', label: 'Column gap (px)', tab: 'general', min: 0, max: 160, step: 4 },
  {
    kind: 'select',
    key: 'layout',
    label: 'Display columns as',
    tab: 'general',
    options: [
      { value: 'columns', label: 'Columns side by side' },
      { value: 'carousel', label: 'Carousel (one column per slide)' },
    ],
  },
  { kind: 'number', key: 'slidesPerView', label: 'Slides visible at once', tab: 'general', min: 1, max: 4, step: 1 },
  { kind: 'toggle', key: 'autoplay', label: 'Autoplay' },
  { kind: 'number', key: 'intervalSeconds', label: 'Seconds per slide', tab: 'general', min: 2, max: 30, step: 1 },
  { kind: 'toggle', key: 'arrows', label: 'Show arrows' },
  { kind: 'toggle', key: 'dots', label: 'Show dots' },
  {
    kind: 'select',
    key: 'backgroundType',
    label: 'Background type',
    tab: 'style',
    options: [
      { value: 'none', label: 'None' },
      { value: 'color', label: 'Colour' },
      { value: 'image', label: 'Image' },
      { value: 'video', label: 'Video' },
    ],
  },
  { kind: 'color', key: 'backgroundColor', label: 'Background colour', tab: 'style' },
  { kind: 'image', key: 'backgroundImage', label: 'Background image', tab: 'style' },
  { kind: 'text', key: 'backgroundVideo', label: 'Background video URL', tab: 'style', placeholder: 'https://…/clip.mp4' },
  { kind: 'color', key: 'overlayColor', label: 'Overlay colour', tab: 'style' },
  { kind: 'range', key: 'overlayOpacity', label: 'Overlay opacity', tab: 'style', min: 0, max: 100, step: 5, unit: '%' },
  { kind: 'box', key: 'padding', label: 'Padding', tab: 'style' },
  { kind: 'box', key: 'margin', label: 'Margin', tab: 'style' },
  { kind: 'range', key: 'borderWidth', label: 'Border width', tab: 'style', min: 0, max: 20, step: 1, unit: 'px' },
  {
    kind: 'select',
    key: 'borderStyle',
    label: 'Border style',
    tab: 'style',
    options: [
      { value: 'solid', label: 'Solid' },
      { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' },
      { value: 'double', label: 'Double' },
    ],
  },
  { kind: 'color', key: 'borderColor', label: 'Border colour', tab: 'style' },
  { kind: 'range', key: 'radius', label: 'Corner radius', tab: 'style', min: 0, max: 60, step: 1, unit: 'px' },
  {
    kind: 'select',
    key: 'shadow',
    label: 'Shadow',
    tab: 'style',
    options: [
      { value: 'none', label: 'None' },
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' },
      { value: 'xl', label: 'Extra large' },
    ],
  },
  { kind: 'text', key: 'cssId', label: 'CSS id', tab: 'advanced' },
  { kind: 'text', key: 'cssClass', label: 'CSS classes', tab: 'advanced' },
  { kind: 'toggle', key: 'visibility.desktop', label: 'Visible on desktop', tab: 'advanced' },
  { kind: 'toggle', key: 'visibility.tablet', label: 'Visible on tablet', tab: 'advanced' },
  { kind: 'toggle', key: 'visibility.mobile', label: 'Visible on mobile', tab: 'advanced' },
];

const COLUMN_FIELDS: FieldDef[] = [
  { kind: 'number', key: 'width', label: 'Width (%)', tab: 'general', min: 5, max: 100, step: 1 },
  { kind: 'select', key: 'valign', label: 'Vertical alignment', tab: 'general', options: VALIGN_OPTIONS },
  { kind: 'toggle', key: 'reverseOnMobile', label: 'Reverse on mobile', tab: 'general' },
  {
    kind: 'select',
    key: 'stackOrder',
    label: 'Stack order on mobile',
    tab: 'general',
    options: [
      { value: 'natural', label: 'As laid out' },
      { value: 'reverse', label: 'Last column first' },
    ],
  },
  { kind: 'color', key: 'backgroundColor', label: 'Background colour', tab: 'style' },
  { kind: 'box', key: 'padding', label: 'Padding', tab: 'style' },
  { kind: 'range', key: 'borderWidth', label: 'Border width', tab: 'style', min: 0, max: 20, step: 1, unit: 'px' },
  { kind: 'color', key: 'borderColor', label: 'Border colour', tab: 'style' },
  { kind: 'range', key: 'radius', label: 'Corner radius', tab: 'style', min: 0, max: 60, step: 1, unit: 'px' },
  { kind: 'text', key: 'cssClass', label: 'CSS classes', tab: 'advanced' },
];

export const BLOCK_DEFS: Record<NodeType, BlockDef> = {
  row: {
    type: 'row',
    label: 'Row',
    group: 'layout',
    groupLabel: 'Layout',
    icon: LayoutTemplate,
    accent: 'text-sky-500',
    description: 'A horizontal band of columns — the skeleton of the page.',
    defaultProps: () => cloneProps(DEFAULT_ROW_PROPS),
    fields: ROW_FIELDS,
    hasChildren: true,
    childTypes: ['column'],
  },
  column: {
    type: 'column',
    label: 'Column',
    group: 'layout',
    groupLabel: 'Layout',
    icon: Columns3,
    accent: 'text-sky-600',
    description: 'A vertical slice inside a row that holds modules and nested rows.',
    defaultProps: () => cloneProps(DEFAULT_COLUMN_PROPS),
    fields: COLUMN_FIELDS,
    hasChildren: true,
    childTypes: [],
  },
  /* ---------------------------------------------------------------- layout */
  columns_2: {
    type: 'columns_2',
    label: '2 Columns',
    group: 'layout',
    groupLabel: 'Layout',
    icon: Columns3,
    accent: 'text-violet-500',
    hasChildren: true,
    childTypes: ['heading', 'paragraph', 'image', 'button', 'spacer', 'html', 'testimonial'],
    defaultProps: () => ({ gap: 'medium' }),
    fields: [
      {
        kind: 'select',
        key: 'gap',
        label: 'Gap',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      SPACING_FIELD,
    ],
  },
  columns_3: {
    type: 'columns_3',
    label: '3 Columns',
    group: 'layout',
    groupLabel: 'Layout',
    icon: Columns3,
    accent: 'text-violet-500',
    hasChildren: true,
    childTypes: ['heading', 'paragraph', 'image', 'button', 'spacer', 'html', 'testimonial'],
    defaultProps: () => ({ gap: 'medium' }),
    fields: [
      {
        kind: 'select',
        key: 'gap',
        label: 'Gap',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      SPACING_FIELD,
    ],
  },
  columns_4: {
    type: 'columns_4',
    label: '4 Columns',
    group: 'layout',
    groupLabel: 'Layout',
    icon: Columns3,
    accent: 'text-violet-500',
    hasChildren: true,
    childTypes: ['heading', 'paragraph', 'image', 'button', 'spacer'],
    defaultProps: () => ({ gap: 'medium' }),
    fields: [
      {
        kind: 'select',
        key: 'gap',
        label: 'Gap',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
    ],
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer',
    group: 'layout',
    groupLabel: 'Layout',
    icon: Minus,
    accent: 'text-zinc-400',
    defaultProps: () => ({ size: 'medium', height: 40 }),
    fields: [
      {
        kind: 'select',
        key: 'size',
        label: 'Height',
        options: [
          { value: 'small', label: 'Small (20px)' },
          { value: 'medium', label: 'Medium (40px)' },
          { value: 'large', label: 'Large (80px)' },
          { value: 'custom', label: 'Custom' },
        ],
      },
      { kind: 'number', key: 'height', label: 'Custom height (px)', min: 0, max: 600 },
    ],
  },

  /* --------------------------------------------------------------- content */
  heading: {
    type: 'heading',
    label: 'Heading',
    group: 'content',
    groupLabel: 'Content',
    icon: Heading1,
    accent: 'text-sky-500',
    minWidth: 200,
    maxWidth: 1100,
    defaultWidth: 'full',
    defaultProps: () => ({
      text: 'A clear, compelling heading',
      level: 'h2',
      style: 'default',
      align: 'left',
      color: '',
      width: 'full',
    }),
    fields: [
      { kind: 'text', key: 'text', label: 'Text' },
      {
        kind: 'heading',
        key: 'level',
        label: 'Level',
      },
      {
        kind: 'select',
        key: 'style',
        label: 'Style',
        options: [
          { value: 'default', label: 'Default (bold)' },
          { value: 'display', label: 'Large serif display' },
        ],
      },
      ALIGN_FIELD,
      { kind: 'color', key: 'color', label: 'Colour' },
      widthField(),
    ],
  },
  paragraph: {
    type: 'paragraph',
    label: 'Paragraph',
    group: 'content',
    groupLabel: 'Content',
    icon: Type,
    accent: 'text-sky-500',
    minWidth: 200,
    maxWidth: 900,
    defaultWidth: 'full',
    defaultProps: () => ({
      text: 'Write something meaningful. Select any block on the canvas to edit its settings.',
      align: 'left',
      size: 'medium',
      color: '',
      width: 'full',
    }),
    fields: [
      { kind: 'richtext', key: 'text', label: 'Text' },
      ALIGN_FIELD,
      {
        kind: 'select',
        key: 'size',
        label: 'Size',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      { kind: 'color', key: 'color', label: 'Colour' },
      widthField(),
    ],
  },
  button: {
    type: 'button',
    label: 'Button',
    group: 'content',
    groupLabel: 'Content',
    icon: MousePointerClick,
    accent: 'text-sky-500',
    minWidth: 140,
    maxWidth: 600,
    defaultWidth: 'full',
    defaultProps: () => ({
      text: 'Learn more',
      url: '/home',
      variant: 'primary',
      icon: 'none',
      color: '',
      align: 'left',
      openNewTab: false,
      width: 'full',
    }),
    fields: [
      { kind: 'text', key: 'text', label: 'Button text' },
      { kind: 'link', key: 'url', label: 'Link URL', placeholder: 'https://… or /home' },
      {
        kind: 'select',
        key: 'variant',
        label: 'Style',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'secondary', label: 'Secondary' },
          { value: 'outline', label: 'Outline' },
          { value: 'link', label: 'Text link (underlined)' },
        ],
      },
      {
        kind: 'select',
        key: 'icon',
        label: 'Icon',
        options: [
          { value: 'none', label: 'None' },
          { value: 'cart', label: 'Shopping bag' },
        ],
      },
      { kind: 'color', key: 'color', label: 'Colour (optional)' },
      ALIGN_FIELD,
      { kind: 'toggle', key: 'openNewTab', label: 'Open in new tab' },
    ],
  },
  badge: {
    type: 'badge',
    label: 'Label',
    group: 'content',
    groupLabel: 'Content',
    icon: Tag,
    accent: 'text-sky-500',
    description: 'A small outlined tag, e.g. a category name above a heading.',
    defaultProps: () => ({
      text: 'Category',
      align: 'left',
      color: '#6b5a22',
    }),
    fields: [
      { kind: 'text', key: 'text', label: 'Text' },
      ALIGN_FIELD,
      { kind: 'color', key: 'color', label: 'Colour' },
    ],
  },
  html: {
    type: 'html',
    label: 'HTML / Embed',
    group: 'content',
    groupLabel: 'Content',
    icon: Code2,
    accent: 'text-amber-500',
    description: 'Only paste HTML you trust.',
    defaultProps: () => ({
      code: '<div style="padding:24px;text-align:center;color:#71717a">Paste an iframe or custom HTML here.</div>',
    }),
    fields: [{ kind: 'textarea', key: 'code', label: 'Raw HTML', rows: 8 }],
  },

  /* ----------------------------------------------------------------- media */
  image: {
    type: 'image',
    label: 'Image',
    group: 'media',
    groupLabel: 'Media',
    icon: ImageIcon,
    accent: 'text-emerald-500',
    defaultWidth: 'full',
    defaultProps: () => ({
      src: '',
      alt: '',
      caption: '',
      width: 'full',
      align: 'left',
      ratio: '16 / 10',
      fit: 'cover',
      background: '',
      rounded: 'medium',
      link: '',
    }),
    fields: [
      { kind: 'image', key: 'src', label: 'Image' },
      { kind: 'text', key: 'alt', label: 'Alt text' },
      { kind: 'text', key: 'caption', label: 'Caption' },
      widthField(),
      ALIGN_FIELD,
      {
        kind: 'select',
        key: 'ratio',
        label: 'Shape',
        options: [
          { value: '21 / 9', label: 'Wide banner 21:9' },
          { value: '16 / 9', label: 'Landscape 16:9' },
          { value: '16 / 10', label: 'Landscape 16:10' },
          { value: '4 / 3', label: 'Landscape 4:3' },
          { value: '1 / 1', label: 'Square' },
          { value: '10 / 11', label: 'Cover (portrait)' },
          { value: '3 / 4', label: 'Portrait 3:4' },
        ],
      },
      {
        kind: 'select',
        key: 'fit',
        label: 'Fit',
        options: [
          { value: 'cover', label: 'Fill the shape (crop)' },
          { value: 'contain', label: 'Show the whole picture' },
        ],
      },
      { kind: 'color', key: 'background', label: 'Background behind the picture' },
      {
        kind: 'select',
        key: 'rounded',
        label: 'Corners',
        options: [
          { value: 'none', label: 'Square' },
          { value: 'medium', label: 'Rounded' },
          { value: 'full', label: 'Circle' },
        ],
      },
      { kind: 'link', key: 'link', label: 'Link URL (optional)' },
    ],
  },
  gallery: {
    type: 'gallery',
    label: 'Gallery',
    group: 'media',
    groupLabel: 'Media',
    icon: Images,
    accent: 'text-emerald-500',
    defaultProps: () => ({ images: [], columns: '3', gap: 'medium', rounded: 'medium' }),
    fields: [
      { kind: 'images', key: 'images', label: 'Images' },
      {
        kind: 'select',
        key: 'columns',
        label: 'Columns',
        options: [
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
      },
      {
        kind: 'select',
        key: 'gap',
        label: 'Gap',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      {
        kind: 'select',
        key: 'rounded',
        label: 'Corners',
        options: [
          { value: 'none', label: 'Square' },
          { value: 'medium', label: 'Rounded' },
        ],
      },
    ],
  },

  /* -------------------------------------------------------------- commerce */
  product_grid: {
    type: 'product_grid',
    label: 'Product Grid',
    group: 'commerce',
    groupLabel: 'Commerce',
    icon: PackageSearch,
    accent: 'text-rose-500',
    description: 'Pulls live products from the shared catalogue.',
    defaultProps: () => ({
      source: 'latest',
      categoryId: '',
      manualIds: [],
      layout: 'carousel',
      columns: '4',
      limit: 8,
      title: 'Featured products',
      showTitle: true,
    }),
    fields: [
      { kind: 'toggle', key: 'showTitle', label: 'Show section title' },
      { kind: 'text', key: 'title', label: 'Section title' },
      {
        kind: 'productSource',
        key: 'source',
        label: 'Products to show',
      },
      { kind: 'category', key: 'categoryId', label: 'Category' },
      { kind: 'products', key: 'manualIds', label: 'Pick products' },
      {
        kind: 'select',
        key: 'layout',
        label: 'Layout',
        options: [
          { value: 'carousel', label: 'Carousel' },
          { value: 'grid', label: 'Grid' },
        ],
      },
      {
        kind: 'select',
        key: 'columns',
        label: 'Columns',
        options: [
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ],
      },
      {
        kind: 'select',
        key: 'limit',
        label: 'Number of products',
        options: [
          { value: 4, label: '4' },
          { value: 8, label: '8' },
          { value: 12, label: '12' },
          { value: 16, label: '16' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------- marketing */
  hero: {
    type: 'hero',
    label: 'Hero Banner',
    group: 'marketing',
    groupLabel: 'Marketing',
    icon: LayoutTemplate,
    accent: 'text-fuchsia-500',
    minWidth: 320,
    defaultProps: () => ({
      title: 'Everything your story deserves',
      subtitle: 'Introduce your store with one confident line.',
      image: '',
      overlay: 45,
      textColor: 'light',
      ctaText: 'Shop now',
      ctaUrl: '/home',
      ctaText2: '',
      ctaUrl2: '',
      align: 'center',
      height: 'medium',
      padding: 'large',
    }),
    fields: [
      { kind: 'text', key: 'title', label: 'Title' },
      { kind: 'textarea', key: 'subtitle', label: 'Subtitle', rows: 3 },
      { kind: 'image', key: 'image', label: 'Background image' },
      { kind: 'range', key: 'overlay', label: 'Overlay opacity', min: 0, max: 100, unit: '%' },
      {
        kind: 'select',
        key: 'textColor',
        label: 'Text colour',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
      },
      {
        kind: 'select',
        key: 'align',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
      },
      {
        kind: 'select',
        key: 'height',
        label: 'Height',
        options: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
        ],
      },
      { kind: 'text', key: 'ctaText', label: 'Button text' },
      { kind: 'text', key: 'ctaUrl', label: 'Button URL' },
      { kind: 'text', key: 'ctaText2', label: 'Second button text (optional)' },
      { kind: 'text', key: 'ctaUrl2', label: 'Second button URL' },
      SPACING_FIELD,
    ],
  },
  hero_carousel: {
    type: 'hero_carousel',
    label: 'Hero Carousel',
    group: 'marketing',
    groupLabel: 'Marketing',
    icon: LayoutTemplate,
    accent: 'text-fuchsia-500',
    description: 'A rotating storefront hero — drag the slides to reorder them.',
    minWidth: 320,
    defaultProps: () => ({
      slides: [
        {
          image: '',
          category: 'Libra',
          title: 'Titulli i slide-it',
          price: '',
          url: '/home/products',
          ctaLabel: 'Shiko produktin',
        },
      ],
      secondaryLabel: 'Të gjitha librat',
      secondaryUrl: '/home/products',
      layout: 'image-right',
      height: 'standard',
      textAlign: 'left',
      background: '',
      textColor: '',
      overlayColor: '#000000',
      overlayOpacity: 35,
      autoplay: true,
      intervalSeconds: 5,
    }),
    fields: [
      {
        kind: 'items',
        key: 'slides',
        label: 'Slides',
        itemLabel: 'Slide',
        addLabel: 'Add slide',
        fields: [
          { kind: 'image', key: 'image', label: 'Image' },
          { kind: 'text', key: 'category', label: 'Eyebrow / category', placeholder: 'Libra' },
          { kind: 'text', key: 'title', label: 'Title' },
          { kind: 'text', key: 'price', label: 'Price', placeholder: '20.00' },
          { kind: 'text', key: 'url', label: 'Link', placeholder: '/home/products/12' },
          { kind: 'text', key: 'ctaLabel', label: 'Button label', placeholder: 'Shiko produktin' },
        ],
      },
      {
        kind: 'select',
        key: 'layout',
        label: 'Hero layout',
        options: [
          { value: 'image-right', label: 'Image right' },
          { value: 'image-left', label: 'Image left' },
          { value: 'image-full', label: 'Full-bleed background' },
        ],
      },
      {
        kind: 'select',
        key: 'height',
        label: 'Container height',
        options: [
          { value: 'compact', label: 'Compact' },
          { value: 'standard', label: 'Standard' },
          { value: 'full', label: 'Full screen' },
        ],
      },
      {
        kind: 'select',
        key: 'textAlign',
        label: 'Content position',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
        ],
      },
      { kind: 'text', key: 'secondaryLabel', label: 'Secondary button' },
      { kind: 'text', key: 'secondaryUrl', label: 'Secondary link' },
      { kind: 'color', key: 'background', label: 'Background colour' },
      { kind: 'color', key: 'textColor', label: 'Text colour' },
      { kind: 'color', key: 'overlayColor', label: 'Overlay colour (full-bleed)' },
      { kind: 'range', key: 'overlayOpacity', label: 'Overlay opacity', min: 0, max: 100, unit: '%' },
      { kind: 'toggle', key: 'autoplay', label: 'Autoplay slides' },
      { kind: 'range', key: 'intervalSeconds', label: 'Seconds per slide', min: 3, max: 15, unit: 's' },
    ],
  },
  cta: {
    type: 'cta',
    label: 'CTA Section',
    group: 'marketing',
    groupLabel: 'Marketing',
    icon: Megaphone,
    accent: 'text-fuchsia-500',
    defaultProps: () => ({
      title: 'Ready to get started?',
      description: 'Tell shoppers exactly what to do next.',
      button: 'Browse the catalogue',
      url: '/home',
      background: '',
      textColor: 'light',
      align: 'center',
      padding: 'large',
    }),
    fields: [
      { kind: 'text', key: 'title', label: 'Title' },
      { kind: 'textarea', key: 'description', label: 'Description', rows: 3 },
      { kind: 'text', key: 'button', label: 'Button text' },
      { kind: 'text', key: 'url', label: 'Button URL' },
      { kind: 'color', key: 'background', label: 'Background colour' },
      {
        kind: 'select',
        key: 'textColor',
        label: 'Text colour',
        options: [
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ],
      },
      {
        kind: 'select',
        key: 'align',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
      },
      SPACING_FIELD,
    ],
  },
  faq: {
    type: 'faq',
    label: 'FAQ Accordion',
    group: 'marketing',
    groupLabel: 'Marketing',
    icon: HelpCircle,
    accent: 'text-fuchsia-500',
    defaultProps: () => ({
      title: 'Frequently asked questions',
      items: [
        { q: 'How long does shipping take?', a: 'Orders are prepared within 24 hours and delivered in 2–4 working days.' },
        { q: 'Can I return an item?', a: 'Yes — returns are accepted within 14 days in original condition.' },
      ],
      openFirst: true,
      padding: 'large',
    }),
    fields: [
      { kind: 'text', key: 'title', label: 'Section title' },
      { kind: 'toggle', key: 'openFirst', label: 'Open first item by default' },
      {
        kind: 'items',
        key: 'items',
        label: 'Questions',
        itemLabel: 'Question',
        addLabel: 'Add question',
        fields: [
          { kind: 'text', key: 'q', label: 'Question' },
          { kind: 'textarea', key: 'a', label: 'Answer', rows: 4 },
        ],
      },
      SPACING_FIELD,
    ],
  },
  testimonial: {
    type: 'testimonial',
    label: 'Testimonials',
    group: 'marketing',
    groupLabel: 'Marketing',
    icon: MessageSquareQuote,
    accent: 'text-fuchsia-500',
    defaultProps: () => ({
      title: 'What customers say',
      layout: 'grid',
      items: [
        {
          name: 'Elira Krasniqi',
          role: 'Verified buyer',
          text: 'Beautiful quality and delivered earlier than expected. I will order again.',
          avatar: '',
        },
        {
          name: 'Driton Berisha',
          role: 'Local business',
          text: 'The shop made it easy to find exactly what I needed in a couple of minutes.',
          avatar: '',
        },
      ],
      padding: 'large',
    }),
    fields: [
      { kind: 'text', key: 'title', label: 'Section title' },
      {
        kind: 'select',
        key: 'layout',
        label: 'Layout',
        options: [
          { value: 'grid', label: 'Card grid' },
          { value: 'list', label: 'Stacked list' },
        ],
      },
      {
        kind: 'items',
        key: 'items',
        label: 'Testimonials',
        itemLabel: 'Testimonial',
        addLabel: 'Add testimonial',
        fields: [
          { kind: 'text', key: 'name', label: 'Name' },
          { kind: 'text', key: 'role', label: 'Role' },
          { kind: 'textarea', key: 'text', label: 'Quote', rows: 4 },
          { kind: 'image', key: 'avatar', label: 'Avatar' },
        ],
      },
      SPACING_FIELD,
    ],
  },

  /* ------------------------------------------------------------ storefront
     These render the real shop sections with live catalogue data, so they
     only produce output on `/home`; elsewhere the builder shows a stand-in. */
  store_products: {
    type: 'store_products',
    label: 'Product Showcase',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: PackageSearch,
    accent: 'text-emerald-500',
    description: 'A carousel of catalogue products with an eyebrow and a title.',
    defaultProps: () => ({
      eyebrow: 'Your Shopping Expo',
      title: 'PRODUKTET E REJA',
      source: 'latest',
      categoryId: 0,
      productIds: [],
      limit: 12,
      offset: 0,
    }),
    fields: [
      { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
      { kind: 'text', key: 'title', label: 'Title' },
      {
        kind: 'productSource',
        key: 'source',
        label: 'Which products',
      },
      { kind: 'category', key: 'categoryId', label: 'Category' },
      { kind: 'products', key: 'productIds', label: 'Pick products' },
      { kind: 'number', key: 'limit', label: 'How many products', min: 1, max: 40 },
      { kind: 'number', key: 'offset', label: 'Skip first N products', min: 0, max: 200 },
    ],
  },
  store_categories: {
    type: 'store_categories',
    label: 'Shop by Category',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: Grid2x2,
    accent: 'text-emerald-500',
    description: 'Category tabs with the matching products underneath.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_stats: {
    type: 'store_stats',
    label: 'Catalogue Stats',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: BarChart3,
    accent: 'text-emerald-500',
    description: 'Live counts of titles, categories and stock.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_about: {
    type: 'store_about',
    label: 'About Band',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: BookOpen,
    accent: 'text-emerald-500',
    description: 'The editorial "discover new worlds" band.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_deal: {
    type: 'store_deal',
    label: 'Featured Deal',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: Tag,
    accent: 'text-emerald-500',
    description: 'One highlighted title with its image and copy.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_story: {
    type: 'store_story',
    label: 'Story Feature',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: Sparkles,
    accent: 'text-emerald-500',
    description: 'A single product told as a story, with price and stock.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_mind: {
    type: 'store_mind',
    label: 'Category Spotlight',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: LayoutTemplate,
    accent: 'text-emerald-500',
    description: 'A category list beside one featured product.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_blog: {
    type: 'store_blog',
    label: 'Latest Posts',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: Newspaper,
    accent: 'text-emerald-500',
    description: 'The three newest blog posts.',
    defaultProps: () => ({}),
    fields: [],
  },
  store_widgets: {
    type: 'store_widgets',
    label: 'Widget Area',
    group: 'storefront',
    groupLabel: 'Storefront sections',
    icon: Grid2x2,
    accent: 'text-emerald-500',
    description: 'Whatever is configured for the homepage widget area.',
    defaultProps: () => ({}),
    fields: [],
  },
};

/* The library no longer offers the old flat `columns_N` blocks: the Rows tab
   owns column layouts. The types stay registered so stored documents keep
   working — `normalizeBlocks` lifts them into real rows. */
const LEGACY_COLUMN_BLOCKS = ['columns_2', 'columns_3', 'columns_4'];

export const BLOCK_LIST: BlockDef[] = Object.values(BLOCK_DEFS).filter(
  (def) => !isLayoutType(def.type) && !LEGACY_COLUMN_BLOCKS.includes(def.type),
);

let idCounter = 0;

export function newBlockId() {
  idCounter += 1;
  return `blk_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function isLayoutType(value: unknown): value is LayoutType {
  return value === 'row' || value === 'column';
}

export function isRow(block: Block): block is Block & { type: 'row' } {
  return block.type === 'row';
}

export function isColumn(block: Block): block is Block & { type: 'column' } {
  return block.type === 'column';
}

/** True for content modules only — rows/columns are structure, not modules. */
export function isBlockType(value: unknown): value is BlockType {
  return (
    typeof value === 'string' &&
    !isLayoutType(value) &&
    Object.prototype.hasOwnProperty.call(BLOCK_DEFS, value)
  );
}

export function createBlock(type: NodeType): Block {
  const def = BLOCK_DEFS[type];
  if (!def) throw new Error(`Unknown block type: ${String(type)}`);
  const block: Block = {
    id: newBlockId(),
    type,
    props: def.defaultProps(),
  };
  if (def.hasChildren) {
    block.children = [];
  }
  return block;
}

/** A column holding `children`, sized as a percentage of its row. */
export function createColumn(width: number, children: Block[] = []): Block {
  const column = createBlock('column');
  column.props.width = roundWidth(width);
  column.children = children;
  return column;
}

/** A row with `count` equally sized empty columns. */
export function createRow(count = 1, props?: BlockProps): Block {
  const columns = Math.max(1, Math.round(count));
  const row = createBlock('row');
  if (props) row.props = mergeProps(DEFAULT_ROW_PROPS, props);
  row.children = Array.from({ length: columns }, () => createColumn(100 / columns));
  return row;
}

function roundWidth(value: number): number {
  return Math.round(value * 100) / 100;
}

/* --------------------------------------------------------- normalisation */

const BREAKPOINTS: Breakpoint[] = ['desktop', 'tablet', 'mobile'];

/** Stored JSON is untrusted: keep only the breakpoints we understand. */
function normalizeResponsive(value: unknown): Responsive | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: Responsive = {};
  for (const breakpoint of BREAKPOINTS) {
    const entry = (value as Record<string, unknown>)[breakpoint];
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).length) {
      out[breakpoint] = { ...(entry as BlockProps) };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** Merge stored props over defaults, coercing types so renders never crash. */
function mergeProps(base: BlockProps, raw: unknown): BlockProps {
  const out = cloneProps(base);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    const fallback = out[key];
    if (key === 'padding' || key === 'margin') {
      out[key] = normalizeBox(value, fallback);
      continue;
    }
    if (key === 'visibility') {
      out.visibility = { ...out.visibility, ...(typeof value === 'object' && value ? value : {}) };
      continue;
    }
    if (typeof fallback === 'number') {
      const num = Number(value);
      if (Number.isFinite(num)) out[key] = num;
      continue;
    }
    if (typeof fallback === 'string') {
      if (typeof value === 'string') out[key] = value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function makeRow(columns: Block[], source?: Record<string, unknown>): Block {
  const row = createBlock('row');
  if (source) {
    if (typeof source.id === 'string' && source.id) row.id = source.id;
    if (source.props && typeof source.props === 'object') {
      row.props = mergeProps(DEFAULT_ROW_PROPS, source.props);
    }
    const responsive = normalizeResponsive(source.responsive);
    if (responsive) row.responsive = responsive;
  }
  row.children = columns;
  return row;
}

function normalizeColumn(raw: Record<string, unknown>): Block {
  const column = createBlock('column');
  if (typeof raw.id === 'string' && raw.id) column.id = raw.id;
  const merged = mergeProps(DEFAULT_COLUMN_PROPS, raw.props);
  // An explicit width is preserved; a missing one is filled in by the caller.
  const declared = Number((raw.props as Record<string, unknown> | undefined)?.width);
  if (!(Number.isFinite(declared) && declared > 0)) delete merged.width;
  column.props = merged;
  const responsive = normalizeResponsive(raw.responsive);
  if (responsive) column.responsive = responsive;
  const children: Block[] = [];
  for (const entry of Array.isArray(raw.children) ? raw.children : []) {
    if (!entry || typeof entry !== 'object') continue;
    const node = normalizeChild(entry as Record<string, unknown>);
    if (node) children.push(node);
  }
  column.children = children;
  return column;
}

function normalizeRow(raw: Record<string, unknown>): Block {
  return makeRow(normalizeColumns(raw.children), raw);
}

/** Normalise a row's children, distributing widths across columns. */
function normalizeColumns(value: unknown): Block[] {
  const list = Array.isArray(value) ? value : [];
  const columns: Block[] = [];
  let stray: Record<string, unknown>[] = [];

  const flushStray = () => {
    if (!stray.length) return;
    const nodes: Block[] = [];
    for (const entry of stray) {
      const node = normalizeChild(entry);
      if (node) nodes.push(node);
    }
    stray = [];
    if (nodes.length) {
      const column = createColumn(100, nodes);
      // Width is decided by the distribution pass below.
      delete column.props.width;
      columns.push(column);
    }
  };

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const typed = entry as Record<string, unknown>;
    if (typed.type === 'column') {
      flushStray();
      columns.push(normalizeColumn(typed));
    } else {
      stray.push(typed);
    }
  }
  flushStray();

  if (!columns.length) return columns;

  const declared = columns.reduce(
    (sum, column) => sum + (Number.isFinite(column.props.width) ? column.props.width : 0),
    0,
  );
  const missing = columns.filter((column) => !Number.isFinite(column.props.width)).length;
  const share = missing ? Math.max(0, roundWidth((100 - declared) / missing)) : 0;

  if (missing && share <= 0) {
    const even = roundWidth(100 / columns.length);
    return columns.map((column) => ({ ...column, props: { ...column.props, width: even } }));
  }
  return columns.map((column) =>
    Number.isFinite(column.props.width)
      ? column
      : { ...column, props: { ...column.props, width: share } },
  );
}

/** Legacy `columns_2/3/4` become a row with N columns, children index→column. */
function liftColumns(raw: Record<string, unknown>, type: string): Block {
  const count = type === 'columns_2' ? 2 : type === 'columns_3' ? 3 : 4;
  const kids = Array.isArray(raw.children) ? raw.children : [];
  const each = roundWidth(100 / count);
  const columns: Block[] = [];

  for (let index = 0; index < count; index += 1) {
    const column = createColumn(each);
    const kid = kids[index];
    if (kid && typeof kid === 'object') {
      const node = normalizeChild(kid as Record<string, unknown>);
      if (node) column.children!.push(node);
    }
    columns.push(column);
  }
  // Anything beyond the column count lands in the final column.
  for (let index = count; index < kids.length; index += 1) {
    const kid = kids[index];
    if (!kid || typeof kid !== 'object') continue;
    const node = normalizeChild(kid as Record<string, unknown>);
    if (node) columns[columns.length - 1].children!.push(node);
  }

  const props = { ...(raw.props && typeof raw.props === 'object' ? raw.props : {}) } as BlockProps;
  // Module-level presets from the flat era mean nothing for a row.
  delete props.width;
  delete props.align;
  return makeRow(columns, { ...raw, props });
}

function normalizeModule(raw: Record<string, unknown>): Block {
  const type = raw.type as BlockType;
  const def = BLOCK_DEFS[type];
  const block: Block = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newBlockId(),
    type,
    props: {
      ...def.defaultProps(),
      ...(raw.props && typeof raw.props === 'object' && !Array.isArray(raw.props) ? raw.props : {}),
    },
  };
  const responsive = normalizeResponsive(raw.responsive);
  if (responsive) block.responsive = responsive;
  if (def.hasChildren) {
    block.children = normalizeChildList(raw.children);
  }
  return block;
}

/** Normalise a list that may contain modules, nested rows or legacy columns. */
function normalizeChildList(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const out: Block[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const node = normalizeChild(raw as Record<string, unknown>);
    if (node) out.push(node);
  }
  return out;
}

/** Deep-clone a block tree while regenerating every id. */
export function cloneBlock(block: Block): Block {
  const copy: Block = {
    id: newBlockId(),
    type: block.type,
    props: JSON.parse(JSON.stringify(block.props ?? {})),
  };
  if (Array.isArray(block.children)) {
    copy.children = block.children.map(cloneBlock);
  }
  if (block.responsive) {
    copy.responsive = JSON.parse(JSON.stringify(block.responsive));
  }
  return copy;
}

function normalizeChild(raw: Record<string, unknown>): Block | null {
  const type = raw.type;
  if (type === 'row') return normalizeRow(raw);
  if (type === 'column') return normalizeColumn(raw);
  if (typeof type === 'string' && LEGACY_COLUMN_BLOCKS.includes(type)) return liftColumns(raw, type);
  if (isBlockType(type)) return normalizeModule(raw);
  return null;
}

/**
 * Repair/normalise any stored JSON so the editor never crashes on old data.
 *
 * The document shape is `row[] → column[] → module|row`. Legacy flat documents
 * are lifted on read: every top-level block becomes its own single-column row
 * and `columns_N` becomes a row with N columns, so pre-tree pages keep
 * rendering exactly as before.
 */
export function normalizeBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const out: Block[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const node = normalizeChild(raw as Record<string, unknown>);
    if (!node) continue;
    if (node.type === 'row') {
      out.push(node);
      continue;
    }
    if (node.type === 'column') {
      out.push(makeRow([node]));
      continue;
    }
    // Legacy flat module → its own single-column row.
    out.push(makeRow([createColumn(100, [node])]));
  }
  return out;
}

export function countBlocks(blocks: Block[]): number {
  return blocks.reduce((total, block) => total + 1 + countBlocks(block.children || []), 0);
}

export const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };

/* ------------------------------------------------------------- transforms
   WordPress-style "Transform to": turn a text-like block into another block
   type in place, keeping its id, text and layout settings (alignment, colour,
   width). Mirrors the block switcher in the Gutenberg toolbar. */

export type TransformTarget = {
  type: NodeType;
  /** Heading level when the target is a specific heading (H1–H6). */
  level?: string;
  label: string;
};

const HEADING_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const TRANSFORMS: Partial<Record<NodeType, NodeType[]>> = {
  heading: ['paragraph', 'button', 'cta', 'html'],
  paragraph: ['heading', 'button', 'cta', 'html'],
  button: ['heading', 'paragraph', 'cta'],
  cta: ['heading', 'paragraph', 'button'],
  html: ['paragraph', 'heading'],
};

function stripHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function plainTextOf(block: Block): string {
  const p = block.props || {};
  switch (block.type) {
    case 'cta':
      return stripHtml(p.title || p.description);
    case 'html':
      return stripHtml(p.code);
    default:
      return stripHtml(p.text);
  }
}

function htmlOf(block: Block): string {
  const p = block.props || {};
  if (block.type === 'paragraph') return String(p.text ?? '');
  if (block.type === 'html') return String(p.code ?? '');
  const text = plainTextOf(block);
  return text ? `<p>${escapeHtml(text)}</p>` : '';
}

/** Block types (and heading levels) `block` can be switched to. */
export function getTransformTargets(block: Block): TransformTarget[] {
  const types = TRANSFORMS[block.type];
  if (!types) return [];
  const targets: TransformTarget[] = [];
  for (const type of types) {
    if (type === 'heading') {
      // Headings are offered per level, like Heading 1–6 in WordPress.
      for (const level of HEADING_LEVELS) {
        targets.push({ type, level, label: `Heading ${level.slice(1)}` });
      }
    } else {
      targets.push({ type, label: BLOCK_DEFS[type].label });
    }
  }
  if (block.type === 'heading') {
    const current = String(block.props?.level || 'h2');
    return [
      ...HEADING_LEVELS.filter((level) => level !== current).map((level) => ({
        type: 'heading' as NodeType,
        level,
        label: `Heading ${level.slice(1)}`,
      })),
      ...targets.filter((target) => target.type !== 'heading'),
    ];
  }
  return targets;
}

/** The same block (same id) re-created as `target`, carrying text and layout over. */
export function transformBlock(
  block: Block,
  target: { type: NodeType; level?: string },
): Block {
  const source = block.props || {};
  const props = BLOCK_DEFS[target.type].defaultProps();
  const text = plainTextOf(block);
  const carry = (key: string) => {
    if (source[key] !== undefined && source[key] !== '' && key in props) {
      props[key] = source[key];
    }
  };

  switch (target.type) {
    case 'heading':
      if (text) props.text = text;
      props.level = target.level || (HEADING_LEVELS.includes(String(source.level)) ? source.level : 'h2');
      carry('align');
      carry('color');
      carry('width');
      break;
    case 'paragraph':
      if (text) props.text = htmlOf(block);
      carry('align');
      carry('color');
      carry('width');
      break;
    case 'button':
      if (text) props.text = text;
      carry('align');
      if (block.type === 'cta' && source.url) props.url = source.url;
      break;
    case 'cta':
      if (block.type === 'paragraph' || block.type === 'html') {
        if (text) props.description = text;
      } else if (text) {
        props.title = text;
      }
      if (block.type === 'button') {
        if (source.url) props.url = source.url;
        if (text) props.button = text;
        props.title = BLOCK_DEFS.cta.defaultProps().title;
      }
      carry('align');
      break;
    case 'html':
      props.code = htmlOf(block) || props.code;
      break;
    default:
      break;
  }

  return { id: block.id, type: target.type, props };
}

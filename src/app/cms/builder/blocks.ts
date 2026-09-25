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
  | 'html'
  | 'image'
  | 'gallery'
  | 'product_grid'
  | 'hero'
  | 'hero_carousel'
  | 'cta'
  | 'faq'
  | 'testimonial'
  /* Storefront sections — rendered by `/shop` with live catalogue data. */
  | 'store_products'
  | 'store_categories'
  | 'store_stats'
  | 'store_about'
  | 'store_deal'
  | 'store_story'
  | 'store_mind'
  | 'store_blog';

export type BlockProps = Record<string, any>;

export type Block = {
  id: string;
  type: BlockType;
  props: BlockProps;
  children?: Block[];
};

export type FieldDef =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
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
  | {
      kind: 'items';
      key: string;
      label: string;
      itemLabel: string;
      addLabel: string;
      fields: FieldDef[];
    };

export type BlockGroup =
  | 'layout'
  | 'content'
  | 'media'
  | 'commerce'
  | 'marketing'
  | 'storefront';

export type BlockDef = {
  type: BlockType;
  label: string;
  group: BlockGroup;
  groupLabel: string;
  icon: typeof Plus;
  accent: string;
  description?: string;
  defaultProps: () => BlockProps;
  fields: FieldDef[];
  hasChildren?: boolean;
  childTypes?: BlockType[];
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

export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
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
      url: '/shop',
      variant: 'primary',
      align: 'left',
      openNewTab: false,
      width: 'full',
    }),
    fields: [
      { kind: 'text', key: 'text', label: 'Button text' },
      { kind: 'text', key: 'url', label: 'Link URL', placeholder: 'https://… or /shop' },
      {
        kind: 'select',
        key: 'variant',
        label: 'Style',
        options: [
          { value: 'primary', label: 'Primary' },
          { value: 'secondary', label: 'Secondary' },
          { value: 'outline', label: 'Outline' },
        ],
      },
      ALIGN_FIELD,
      { kind: 'toggle', key: 'openNewTab', label: 'Open in new tab' },
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
      rounded: 'medium',
      link: '',
    }),
    fields: [
      { kind: 'image', key: 'src', label: 'Image' },
      { kind: 'text', key: 'alt', label: 'Alt text' },
      { kind: 'text', key: 'caption', label: 'Caption' },
      widthField(),
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
      { kind: 'text', key: 'link', label: 'Link URL (optional)' },
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
      { kind: 'products', key: 'manualIds', label: 'Pick products' },
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
      ctaUrl: '/shop',
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
          url: '/shop/products',
          ctaLabel: 'Shiko produktin',
        },
      ],
      secondaryLabel: 'Të gjitha librat',
      secondaryUrl: '/shop/products',
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
          { kind: 'text', key: 'url', label: 'Link', placeholder: '/shop/products/12' },
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
      url: '/shop',
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
     only produce output on `/shop`; elsewhere the builder shows a stand-in. */
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
      limit: 12,
      offset: 0,
    }),
    fields: [
      { kind: 'text', key: 'eyebrow', label: 'Eyebrow' },
      { kind: 'text', key: 'title', label: 'Title' },
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
};

export const BLOCK_LIST: BlockDef[] = Object.values(BLOCK_DEFS);

let idCounter = 0;

export function newBlockId() {
  idCounter += 1;
  return `blk_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function createBlock(type: BlockType): Block {
  const def = BLOCK_DEFS[type];
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

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BLOCK_DEFS, value);
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
  return copy;
}

/** Repair/normalise any stored JSON so the editor never crashes on old data. */
export function normalizeBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const out: Block[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<Block>;
    if (!isBlockType(candidate.type)) continue;
    const def = BLOCK_DEFS[candidate.type];
    const block: Block = {
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : newBlockId(),
      type: candidate.type,
      props: {
        ...def.defaultProps(),
        ...(candidate.props && typeof candidate.props === 'object' ? candidate.props : {}),
      },
    };
    if (def.hasChildren) {
      block.children = normalizeBlocks(candidate.children);
    }
    out.push(block);
  }
  return out;
}

export function countBlocks(blocks: Block[]): number {
  return blocks.reduce((total, block) => total + 1 + countBlocks(block.children || []), 0);
}

export const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };

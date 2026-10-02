'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BadgeDollarSign,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react';
import TiptapEditor from '@/components/editor/TiptapEditor';
import MediaPickerModal, { type PickedMedia } from '@/components/admin/MediaPickerModal';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Label,
  Select,
  cn,
} from '@/components/admin/ui';
import { slugify } from '@/lib/cms/format';
import {
  createProduct,
  deleteVariant,
  saveVariant,
  updateProduct,
} from '@/app/cms/actions/products';
import {
  BACKORDER_OPTIONS,
  PRODUCT_STATUSES,
  type ProductFormValues,
  type VariantFormValues,
} from './types';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import type { Dictionary } from '@/lib/i18n/dictionaries/en';

export type TaxonomyOption = { id: number; name: string; categoryId?: number };

export type EditorVariant = VariantFormValues;

type TabKey = 'general' | 'pricing' | 'images' | 'taxonomy' | 'variants';

const TABS: { key: TabKey; labelKey: keyof Dictionary; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'general', labelKey: 'cmsshared.product_editor.tab_general', icon: FileText },
  { key: 'pricing', labelKey: 'cmsshared.product_editor.tab_pricing', icon: BadgeDollarSign },
  { key: 'images', labelKey: 'cmsshared.product_editor.tab_images', icon: ImageIcon },
  { key: 'taxonomy', labelKey: 'cmsshared.product_editor.tab_taxonomy', icon: Tags },
  { key: 'variants', labelKey: 'cmsshared.product_editor.tab_variants', icon: Layers },
];

const EMPTY_VALUES: ProductFormValues = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  status: 'Active',
  price: '',
  costPrice: '',
  salePrice: '',
  saleFrom: '',
  saleTo: '',
  rating: '',
  sku: '',
  barcode: '',
  stockQuantity: '0',
  minStockLevel: '0',
  backorder: 'deny',
  images: [],
  categoryId: '',
  subCategoryId: '',
  brandId: '',
  unitId: '',
};

function str(formData: FormData, key: string, max = 4000): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export default function ProductEditor({
  mode,
  product,
  taxonomy,
  initialVariants,
}: {
  mode: 'create' | 'edit';
  /** Existing product when editing. */
  product?: ProductFormValues & { id: number };
  taxonomy: {
    categories: TaxonomyOption[];
    subCategories: TaxonomyOption[];
    brands: TaxonomyOption[];
    units: TaxonomyOption[];
  };
  initialVariants: EditorVariant[];
}) {
  const router = useRouter();
  const { t } = useLocale();
  const productId = product?.id;
  const initial = product ?? EMPTY_VALUES;

  const [tab, setTab] = useState<TabKey>('general');
  const [saving, setSaving] = useState(false);

  // General
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const slugTouched = useRef(Boolean(initial.slug));
  const [shortDescription, setShortDescription] = useState(initial.shortDescription);
  const [description, setDescription] = useState(initial.description);

  // Taxonomy
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [subCategoryId, setSubCategoryId] = useState(initial.subCategoryId);

  // Images (images[0] = featured)
  const [images, setImages] = useState<string[]>(initial.images);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'featured' | 'gallery'>('featured');

  // Variants
  const [variantRows, setVariantRows] = useState<EditorVariant[]>(initialVariants);
  const [variantBusy, setVariantBusy] = useState<number | 'add' | 'bulk' | null>(null);
  const variantsJson = JSON.stringify(initialVariants);
  const lastSynced = useRef(variantsJson);

  useEffect(() => {
    if (variantsJson !== lastSynced.current) {
      lastSynced.current = variantsJson;
      setVariantRows(initialVariants);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsJson]);

  const visibleSubCategories = useMemo(
    () =>
      taxonomy.subCategories.filter(
        (sub) => !categoryId || String(sub.categoryId) === categoryId,
      ),
    [taxonomy.subCategories, categoryId],
  );

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched.current) setSlug(slugify(value));
  }

  function onCategoryChange(value: string) {
    setCategoryId(value);
    const stillValid = visibleSubCategories.some((sub) => String(sub.id) === subCategoryId);
    if (!stillValid) setSubCategoryId('');
  }

  function onPick(items: PickedMedia[]) {
    const urls = items.map((item) => item.url).filter(Boolean);
    if (!urls.length) return;
    if (pickerTarget === 'featured') {
      setImages((current) => [urls[0], ...current.filter((url) => url !== urls[0])].slice(0, 24));
      return;
    }
    setImages((current) => Array.from(new Set([...current, ...urls])).slice(0, 24));
  }

  function readValues(formData: FormData): ProductFormValues {
    return {
      name: str(formData, 'name', 255).trim(),
      slug: str(formData, 'slug', 255).trim(),
      shortDescription,
      description,
      status: (str(formData, 'status', 30) || 'Active') as ProductFormValues['status'],
      price: str(formData, 'price', 40).trim(),
      costPrice: str(formData, 'costPrice', 40).trim(),
      salePrice: str(formData, 'salePrice', 40).trim(),
      saleFrom: str(formData, 'saleFrom', 20),
      saleTo: str(formData, 'saleTo', 20),
      rating: str(formData, 'rating', 4).trim(),
      sku: str(formData, 'sku', 100).trim(),
      barcode: str(formData, 'barcode', 100).trim(),
      stockQuantity: str(formData, 'stockQuantity', 20).trim() || '0',
      minStockLevel: str(formData, 'minStockLevel', 20).trim() || '0',
      backorder: (str(formData, 'backorder', 20) || 'deny') as ProductFormValues['backorder'],
      images,
      categoryId: str(formData, 'categoryId', 20),
      subCategoryId: str(formData, 'subCategoryId', 20),
      brandId: str(formData, 'brandId', 20),
      unitId: str(formData, 'unitId', 20),
    };
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = readValues(formData);

    setSaving(true);
    try {
      const result = mode === 'create' ? await createProduct(values) : await updateProduct(product!.id, values);
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.product_editor.save_error'));
        return;
      }
      if (mode === 'create' && result.id) {
        toast.success(t('cmsshared.product_editor.created'));
        router.push(`/cms/products/${result.id}/edit`);
        return;
      }
      toast.success(t('cmsshared.product_editor.saved'));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.product_editor.save_error'));
    } finally {
      setSaving(false);
    }
  }

  function addVariantRow() {
    if (!productId) return;
    setVariantRows((current) => [
      ...current,
      {
        id: null,
        productId,
        name: `Variant ${current.length + 1}`,
        sku: '',
        price: initial.price || '0.00',
        costPrice: '',
        stock: '0',
      },
    ]);
  }

  function updateVariantRow(index: number, patch: Partial<EditorVariant>) {
    setVariantRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  async function saveOneVariant(index: number) {
    const row = variantRows[index];
    if (!row || !productId) return;
    setVariantBusy(index);
    try {
      const result = await saveVariant({ ...row, productId });
      if (!result.ok) {
        toast.error(result.error || t('cmsshared.product_editor.variant_save_error'));
        return;
      }
      toast.success(
        row.id ? t('cmsshared.product_editor.variant_updated') : t('cmsshared.product_editor.variant_added'),
      );
      setVariantRows((current) =>
        current.map((item, i) => (i === index ? { ...result.variant } : item)),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.product_editor.variant_save_error'));
    } finally {
      setVariantBusy(null);
    }
  }

  async function removeVariant(index: number) {
    const row = variantRows[index];
    if (!row || !productId) return;
    if (!window.confirm(t('cmsshared.product_editor.variant_delete_confirm', { name: row.name }))) return;
    setVariantBusy(index);
    try {
      if (row.id) {
        const result = await deleteVariant(row.id, productId);
        if (!result.ok) {
          toast.error(result.error || t('cmsshared.product_editor.variant_delete_error'));
          return;
        }
        toast.success(t('cmsshared.product_editor.variant_deleted'));
        setVariantRows((current) => current.filter((_, i) => i !== index));
        router.refresh();
      } else {
        setVariantRows((current) => current.filter((_, i) => i !== index));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('cmsshared.product_editor.variant_delete_error'));
    } finally {
      setVariantBusy(null);
    }
  }

  const featured = images[0] ?? '';
  const gallery = images.slice(1);

  return (
    <div>
      <form onSubmit={onSubmit}>
        {/* Tabs */}
        <div className="mb-5 overflow-x-auto">
          <div className="flex min-w-max gap-1 rounded-xl border border-zinc-200 bg-white p-1">
            {TABS.map((item) => {
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-[#6d6be8] text-white shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                  )}
                >
                  <item.icon size={15} />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* General */}
        {tab === 'general' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('cmsshared.product_editor.general_title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="slug" value={slug} />

              <Field label={t('cmsshared.product_editor.name_label')} htmlFor="product-name">
                <Input
                  id="product-name"
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder={t('cmsshared.product_editor.name_placeholder')}
                  required
                />
              </Field>

              <Field
                label={t('cmsshared.product_editor.slug_label')}
                htmlFor="product-slug"
                hint={t('cmsshared.product_editor.slug_hint')}
              >
                <Input
                  id="product-slug"
                  value={slug}
                  onChange={(event) => {
                    slugTouched.current = true;
                    setSlug(slugify(event.target.value));
                  }}
                  placeholder="linen-summer-shirt"
                />
              </Field>

              <div>
                <Label htmlFor="product-short">{t('cmsshared.product_editor.short_label')}</Label>
                <div className="rounded-lg border border-zinc-300 bg-white">
                  <TiptapEditor
                    value={shortDescription}
                    onChange={setShortDescription}
                    placeholder={t('cmsshared.product_editor.short_placeholder')}
                    minHeight={140}
                    compact
                  />
                </div>
                <input type="hidden" name="shortDescription" value={shortDescription} />
              </div>

              <div>
                <Label htmlFor="product-description">{t('cmsshared.product_editor.description_label')}</Label>
                <div className="rounded-lg border border-zinc-300 bg-white">
                  <TiptapEditor
                    value={description}
                    onChange={setDescription}
                    placeholder={t('cmsshared.product_editor.description_placeholder')}
                    minHeight={260}
                  />
                </div>
                <input type="hidden" name="description" value={description} />
              </div>

              <Field
                label={t('cmsshared.coupon.status')}
                htmlFor="product-status"
                hint={t('cmsshared.product_editor.status_hint')}
              >
                <Select id="product-status" name="status" defaultValue={initial.status}>
                  {PRODUCT_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardContent>
          </Card>
        ) : null}

        {/* Pricing & inventory */}
        {tab === 'pricing' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('cmsshared.product_editor.pricing_title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label={t('cmsshared.product_editor.price_label')} htmlFor="price" hint={t('cmsshared.product_editor.price_hint')}>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={initial.price}
                  placeholder="0.00"
                />
              </Field>

              <Field label={t('cmsshared.product_editor.cost_label')} htmlFor="costPrice" hint={t('cmsshared.product_editor.cost_hint')}>
                <Input
                  id="costPrice"
                  name="costPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={initial.costPrice}
                  placeholder="0.00"
                />
              </Field>

              <Field
                label={t('cmsshared.product_editor.sale_label')}
                htmlFor="salePrice"
                hint={t('cmsshared.product_editor.sale_hint')}
              >
                <Input
                  id="salePrice"
                  name="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={initial.salePrice}
                  placeholder={t('cmsshared.product_editor.sale_placeholder')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('cmsshared.product_editor.sale_from')} htmlFor="saleFrom">
                  <Input id="saleFrom" name="saleFrom" type="date" defaultValue={initial.saleFrom} />
                </Field>
                <Field label={t('cmsshared.product_editor.sale_to')} htmlFor="saleTo">
                  <Input id="saleTo" name="saleTo" type="date" defaultValue={initial.saleTo} />
                </Field>
              </div>

              <Field
                label={t('cmsshared.product_editor.rating_label')}
                htmlFor="rating"
                hint={t('cmsshared.product_editor.rating_hint')}
              >
                <Select id="rating" name="rating" defaultValue={initial.rating}>
                  <option value="">{t('cmsshared.product_editor.rating_none')}</option>
                  <option value="5">★★★★★ 5</option>
                  <option value="4">★★★★☆ 4</option>
                  <option value="3">★★★☆☆ 3</option>
                  <option value="2">★★☆☆☆ 2</option>
                  <option value="1">★☆☆☆☆ 1</option>
                </Select>
              </Field>

              <Field label={t('cmsshared.product_editor.sku_label')} htmlFor="sku">
                <Input id="sku" name="sku" defaultValue={initial.sku} placeholder="ABC-123" />
              </Field>

              <Field label={t('cmsshared.product_editor.barcode_label')} htmlFor="barcode">
                <Input
                  id="barcode"
                  name="barcode"
                  defaultValue={initial.barcode}
                  placeholder="EAN / UPC"
                />
              </Field>

              <Field label={t('cmsshared.product_editor.stock_label')} htmlFor="stockQuantity">
                <Input
                  id="stockQuantity"
                  name="stockQuantity"
                  type="number"
                  min="0"
                  defaultValue={initial.stockQuantity}
                />
              </Field>

              <Field
                label={t('cmsshared.product_editor.low_stock_label')}
                htmlFor="minStockLevel"
                hint={t('cmsshared.product_editor.low_stock_hint')}
              >
                <Input
                  id="minStockLevel"
                  name="minStockLevel"
                  type="number"
                  min="0"
                  defaultValue={initial.minStockLevel}
                />
              </Field>

              <Field
                label={t('cmsshared.product_editor.backorders_label')}
                htmlFor="backorder"
                hint={t('cmsshared.product_editor.backorders_hint')}
                className="sm:col-span-2"
              >
                <Select id="backorder" name="backorder" defaultValue={initial.backorder}>
                  {BACKORDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <p className="text-xs text-zinc-500 sm:col-span-2">
                {t('cmsshared.product_editor.stock_note')}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Images */}
        {tab === 'images' ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t('cmsshared.product_editor.images_title')}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPickerTarget('featured');
                    setPickerOpen(true);
                  }}
                >
                  {t('cmsshared.product_editor.pick_featured')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPickerTarget('gallery');
                    setPickerOpen(true);
                  }}
                >
                  <Plus size={14} /> {t('cmsshared.product_editor.add_gallery')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {images.map((url) => (
                <input key={url} type="hidden" name="images" value={url} />
              ))}

              <div>
                <Label>{t('cmsshared.product_editor.featured_label')}</Label>
                {featured ? (
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featured}
                      alt={name || t('cmsshared.product_editor.featured_label')}
                      className="h-28 w-28 rounded-lg border border-zinc-200 object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImages((current) => current.slice(1))}
                    >
                      <Trash2 size={14} /> {t('cmsshared.product_editor.remove')}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPickerTarget('featured');
                      setPickerOpen(true);
                    }}
                    className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400 transition hover:border-[#6d6be8] hover:text-[#5b59d6]"
                    aria-label={t('cmsshared.product_editor.choose_featured')}
                  >
                    <ImageIcon size={22} />
                  </button>
                )}
              </div>

              <div>
                <Label>{t('cmsshared.product_editor.gallery_label')}</Label>
                {gallery.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t('cmsshared.product_editor.gallery_empty')}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {gallery.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className="group relative overflow-hidden rounded-lg border border-zinc-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="aspect-square w-full object-cover" />
                        <button
                          type="button"
                          aria-label={t('cmsshared.product_editor.remove_image')}
                          onClick={() =>
                            setImages((current) => current.filter((item) => item !== url))
                          }
                          className="absolute right-1 top-1 rounded-md bg-zinc-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-zinc-500">
                {t('cmsshared.product_editor.images_note_before')}{' '}
                <code>products.image_url</code>
                {t('cmsshared.product_editor.images_note_after')} <code>parseImageUrl</code>
                {t('cmsshared.product_editor.images_note_end')}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Category & taxonomy */}
        {tab === 'taxonomy' ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('cmsshared.product_editor.taxonomy_title')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t('cmsshared.product_editor.category_label')}
                htmlFor="categoryId"
                hint={t('cmsshared.product_editor.category_hint')}
              >
                <Select
                  id="categoryId"
                  value={categoryId}
                  onChange={(event) => onCategoryChange(event.target.value)}
                >
                  <option value="">{t('cmsshared.product_editor.category_none')}</option>
                  {taxonomy.categories.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('cmsshared.product_editor.subcategory_label')}
                htmlFor="subCategoryId"
                hint={t('cmsshared.product_editor.subcategory_hint')}
              >
                <Select
                  id="subCategoryId"
                  value={subCategoryId}
                  onChange={(event) => setSubCategoryId(event.target.value)}
                >
                  <option value="">{t('cmsshared.product_editor.subcategory_none')}</option>
                  {visibleSubCategories.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('cmsshared.product_editor.brand_label')} htmlFor="brandId">
                <Select id="brandId" name="brandId" defaultValue={initial.brandId}>
                  <option value="">{t('cmsshared.product_editor.brand_none')}</option>
                  {taxonomy.brands.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('cmsshared.product_editor.unit_label')}
                htmlFor="unitId"
                hint={t('cmsshared.product_editor.unit_hint')}
              >
                <Select id="unitId" name="unitId" defaultValue={initial.unitId}>
                  <option value="">{t('cmsshared.product_editor.unit_default')}</option>
                  {taxonomy.units.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <p className="text-xs text-zinc-500 sm:col-span-2">
                {t('cmsshared.product_editor.taxonomy_note')}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Variants */}
        {tab === 'variants' ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>{t('cmsshared.product_editor.variants_title')}</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">
                  {productId
                    ? t('cmsshared.product_editor.variants_subtitle')
                    : t('cmsshared.product_editor.variants_subtitle_new')}
                </p>
              </div>
              {productId ? (
                <Button type="button" variant="outline" size="sm" onClick={addVariantRow}>
                  <Plus size={14} /> {t('cmsshared.product_editor.add_variant')}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {!productId ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  {t('cmsshared.product_editor.variants_locked_before')}{' '}
                  <span className="font-medium text-zinc-700">
                    {t('cmsshared.product_editor.create_product')}
                  </span>
                  {t('cmsshared.product_editor.variants_locked_after')}
                </div>
              ) : variantRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  {t('cmsshared.product_editor.variants_empty_before')}{' '}
                  <span className="font-medium text-zinc-700">
                    {t('cmsshared.product_editor.add_variant')}
                  </span>
                  {t('cmsshared.product_editor.variants_empty_after')}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">{t('cmsshared.product_editor.col_name')}</th>
                        <th className="px-3 py-2">{t('cmsshared.product_editor.col_sku')}</th>
                        <th className="px-3 py-2">{t('cmsshared.product_editor.col_price')}</th>
                        <th className="px-3 py-2">{t('cmsshared.product_editor.col_cost')}</th>
                        <th className="px-3 py-2">{t('cmsshared.product_editor.col_stock')}</th>
                        <th className="px-3 py-2 text-right">{t('cmsshared.product_editor.col_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {variantRows.map((row, index) => {
                        const busy = variantBusy === index;
                        return (
                          <tr key={row.id ?? `new-${index}`}>
                            <td className="px-3 py-2">
                              <Input
                                aria-label={t('cmsshared.product_editor.variant_name_aria')}
                                value={row.name}
                                onChange={(event) =>
                                  updateVariantRow(index, { name: event.target.value })
                                }
                                className="h-9 w-40"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                aria-label={t('cmsshared.product_editor.variant_sku_aria')}
                                value={row.sku}
                                onChange={(event) =>
                                  updateVariantRow(index, { sku: event.target.value })
                                }
                                className="h-9 w-32"
                                placeholder="—"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                aria-label={t('cmsshared.product_editor.variant_price_aria')}
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.price}
                                onChange={(event) =>
                                  updateVariantRow(index, { price: event.target.value })
                                }
                                className="h-9 w-28"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                aria-label={t('cmsshared.product_editor.variant_cost_aria')}
                                type="number"
                                step="0.01"
                                min="0"
                                value={row.costPrice}
                                onChange={(event) =>
                                  updateVariantRow(index, { costPrice: event.target.value })
                                }
                                className="h-9 w-28"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                aria-label={t('cmsshared.product_editor.variant_stock_aria')}
                                type="number"
                                min="0"
                                value={row.stock}
                                onChange={(event) =>
                                  updateVariantRow(index, { stock: event.target.value })
                                }
                                className="h-9 w-24"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => saveOneVariant(index)}
                                >
                                  {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                                  {row.id ? t('cmsshared.action.save') : t('cmsshared.action.add')}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => removeVariant(index)}
                                  aria-label={t('cmsshared.product_editor.variant_delete_aria', {
                                    name: row.name,
                                  })}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-zinc-500">
                {t('cmsshared.product_editor.variants_note')}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/cms/products"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              {t('cmsshared.product_editor.back_to_products')}
            </Link>
            {productId ? (
              <a
                href={`/home/products/${productId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                {t('cmsshared.product_editor.view_in_shop')} <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {mode === 'create'
              ? t('cmsshared.product_editor.create')
              : t('cmsshared.action.save_changes')}
          </Button>
        </div>
      </form>

      <MediaPickerModal
        open={pickerOpen}
        mode={pickerTarget === 'featured' ? 'single' : 'multi'}
        onClose={() => setPickerOpen(false)}
        onSelect={onPick}
      />
    </div>
  );
}

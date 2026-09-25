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

export type TaxonomyOption = { id: number; name: string; categoryId?: number };

export type EditorVariant = VariantFormValues;

type TabKey = 'general' | 'pricing' | 'images' | 'taxonomy' | 'variants';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'general', label: 'General', icon: FileText },
  { key: 'pricing', label: 'Pricing & inventory', icon: BadgeDollarSign },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'taxonomy', label: 'Category & taxonomy', icon: Tags },
  { key: 'variants', label: 'Variants', icon: Layers },
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
        toast.error(result.error || 'Could not save the product.');
        return;
      }
      if (mode === 'create' && result.id) {
        toast.success('Product created.');
        router.push(`/cms/products/${result.id}/edit`);
        return;
      }
      toast.success('Product saved.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the product.');
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
        toast.error(result.error || 'Could not save the variant.');
        return;
      }
      toast.success(row.id ? 'Variant updated.' : 'Variant added.');
      setVariantRows((current) =>
        current.map((item, i) => (i === index ? { ...result.variant } : item)),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the variant.');
    } finally {
      setVariantBusy(null);
    }
  }

  async function removeVariant(index: number) {
    const row = variantRows[index];
    if (!row || !productId) return;
    if (!window.confirm(`Delete the variant "${row.name}"? This cannot be undone.`)) return;
    setVariantBusy(index);
    try {
      if (row.id) {
        const result = await deleteVariant(row.id, productId);
        if (!result.ok) {
          toast.error(result.error || 'Could not delete the variant.');
          return;
        }
        toast.success('Variant deleted.');
        setVariantRows((current) => current.filter((_, i) => i !== index));
        router.refresh();
      } else {
        setVariantRows((current) => current.filter((_, i) => i !== index));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the variant.');
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
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* General */}
        {tab === 'general' ? (
          <Card>
            <CardHeader>
              <CardTitle>General information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="slug" value={slug} />

              <Field label="Product name" htmlFor="product-name">
                <Input
                  id="product-name"
                  value={name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="e.g. Linen summer shirt"
                  required
                />
              </Field>

              <Field
                label="Slug"
                htmlFor="product-slug"
                hint="Used in URLs — generated from the name until you edit it."
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
                <Label htmlFor="product-short">Short description</Label>
                <div className="rounded-lg border border-zinc-300 bg-white">
                  <TiptapEditor
                    value={shortDescription}
                    onChange={setShortDescription}
                    placeholder="One or two sentences shown near the price…"
                    minHeight={140}
                    compact
                  />
                </div>
                <input type="hidden" name="shortDescription" value={shortDescription} />
              </div>

              <div>
                <Label htmlFor="product-description">Full description</Label>
                <div className="rounded-lg border border-zinc-300 bg-white">
                  <TiptapEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Write the product description…"
                    minHeight={260}
                  />
                </div>
                <input type="hidden" name="description" value={description} />
              </div>

              <Field
                label="Status"
                htmlFor="product-status"
                hint="Only Active products are shown in the shop."
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
              <CardTitle>Pricing &amp; inventory</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field label="Regular price" htmlFor="price" hint="Shop currency.">
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

              <Field label="Cost price" htmlFor="costPrice" hint="What one unit costs you.">
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
                label="Sale price"
                htmlFor="salePrice"
                hint="Stored with its date window in the product config."
              >
                <Input
                  id="salePrice"
                  name="salePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={initial.salePrice}
                  placeholder="No sale"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Sale from" htmlFor="saleFrom">
                  <Input id="saleFrom" name="saleFrom" type="date" defaultValue={initial.saleFrom} />
                </Field>
                <Field label="Sale to" htmlFor="saleTo">
                  <Input id="saleTo" name="saleTo" type="date" defaultValue={initial.saleTo} />
                </Field>
              </div>

              <Field label="SKU" htmlFor="sku">
                <Input id="sku" name="sku" defaultValue={initial.sku} placeholder="ABC-123" />
              </Field>

              <Field label="Barcode" htmlFor="barcode">
                <Input
                  id="barcode"
                  name="barcode"
                  defaultValue={initial.barcode}
                  placeholder="EAN / UPC"
                />
              </Field>

              <Field label="Stock quantity" htmlFor="stockQuantity">
                <Input
                  id="stockQuantity"
                  name="stockQuantity"
                  type="number"
                  min="0"
                  defaultValue={initial.stockQuantity}
                />
              </Field>

              <Field
                label="Low-stock level"
                htmlFor="minStockLevel"
                hint="Below this quantity the product is flagged as low stock."
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
                label="Backorders"
                htmlFor="backorder"
                hint="What happens when stock reaches zero."
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
                Variant-level stock lives in the Variants tab; the value above is the product
                fallback shown in lists and reports.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Images */}
        {tab === 'images' ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Images</CardTitle>
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
                  Pick featured image
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
                  <Plus size={14} /> Add gallery images
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {images.map((url) => (
                <input key={url} type="hidden" name="images" value={url} />
              ))}

              <div>
                <Label>Featured image</Label>
                {featured ? (
                  <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featured}
                      alt={name || 'Featured image'}
                      className="h-28 w-28 rounded-lg border border-zinc-200 object-cover"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImages((current) => current.slice(1))}
                    >
                      <Trash2 size={14} /> Remove
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
                    aria-label="Choose the featured image"
                  >
                    <ImageIcon size={22} />
                  </button>
                )}
              </div>

              <div>
                <Label>Gallery</Label>
                {gallery.length === 0 ? (
                  <p className="text-sm text-zinc-500">No gallery images yet.</p>
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
                          aria-label="Remove image"
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
                The featured image is the first entry of{' '}
                <code>products.image_url</code>; the gallery is stored in the same column as a JSON
                image list (readable by <code>parseImageUrl</code>).
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Category & taxonomy */}
        {tab === 'taxonomy' ? (
          <Card>
            <CardHeader>
              <CardTitle>Category &amp; taxonomy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Category"
                htmlFor="categoryId"
                hint="Used for storefront breadcrumbs and category pages."
              >
                <Select
                  id="categoryId"
                  value={categoryId}
                  onChange={(event) => onCategoryChange(event.target.value)}
                >
                  <option value="">No category</option>
                  {taxonomy.categories.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Sub-category" htmlFor="subCategoryId" hint="Optional second level.">
                <Select
                  id="subCategoryId"
                  value={subCategoryId}
                  onChange={(event) => setSubCategoryId(event.target.value)}
                >
                  <option value="">None</option>
                  {visibleSubCategories.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Brand" htmlFor="brandId">
                <Select id="brandId" name="brandId" defaultValue={initial.brandId}>
                  <option value="">Unassigned</option>
                  {taxonomy.brands.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Unit" htmlFor="unitId" hint="e.g. piece, kg, box.">
                <Select id="unitId" name="unitId" defaultValue={initial.unitId}>
                  <option value="">Default (piece)</option>
                  {taxonomy.units.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <p className="text-xs text-zinc-500 sm:col-span-2">
                Categories, brands and units are managed in the store admin — new entries created
                there appear here after a refresh.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Variants */}
        {tab === 'variants' ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Variants</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">
                  {productId
                    ? 'Every sellable option needs its own variant — the shop adds to cart per variant.'
                    : 'Save the product first, then come back to add variants.'}
                </p>
              </div>
              {productId ? (
                <Button type="button" variant="outline" size="sm" onClick={addVariantRow}>
                  <Plus size={14} /> Add variant
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              {!productId ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  Variants belong to a saved product. Fill in the General tab and press{' '}
                  <span className="font-medium text-zinc-700">Create product</span> first.
                </div>
              ) : variantRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                  No variants yet. Press <span className="font-medium text-zinc-700">Add variant</span> to
                  create the default sellable option.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Cost</th>
                        <th className="px-3 py-2">Stock</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white">
                      {variantRows.map((row, index) => {
                        const busy = variantBusy === index;
                        return (
                          <tr key={row.id ?? `new-${index}`}>
                            <td className="px-3 py-2">
                              <Input
                                aria-label="Variant name"
                                value={row.name}
                                onChange={(event) =>
                                  updateVariantRow(index, { name: event.target.value })
                                }
                                className="h-9 w-40"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                aria-label="Variant SKU"
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
                                aria-label="Variant price"
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
                                aria-label="Variant cost price"
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
                                aria-label="Variant stock"
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
                                  {row.id ? 'Save' : 'Add'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => removeVariant(index)}
                                  aria-label={`Delete variant ${row.name}`}
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
                Price, cost and stock are saved per variant with the buttons above — they are not part
                of the main product form.
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
              Back to products
            </Link>
            {productId ? (
              <a
                href={`/shop/products/${productId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                View in shop <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {mode === 'create' ? 'Create product' : 'Save changes'}
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

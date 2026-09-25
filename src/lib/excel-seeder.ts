import * as xlsx from 'xlsx';
import { getContextDb } from '@/lib/tenant';
import { 
  products, 
  categories, 
  subCategories, 
  brands, 
  units, 
  productVariants, 
  productAttributeValues,
  categoryAttributes,
  statusEnum
} from '@/db/schema-tenant';
import { eq, and, sql } from 'drizzle-orm';

export interface ProductExcelRow {
  'Product Name': string;
  'Category': string;
  'Subcategory'?: string;
  'Brand'?: string;
  'Unit'?: string;
  'SKU': string;
  'Price': number;
  'Cost Price'?: number;
  'Stock'?: number;
  'Description'?: string;
  'Specifications'?: string; // Format: "Color: Red; Size: XL"
  [key: string]: any;
}

export async function seedProductsFromExcel(fileBuffer: Buffer) {
  const db = await getContextDb();
  
  // 1. Parse Excel
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<ProductExcelRow>(sheet);

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Caches to avoid redundant lookups
  const brandCache = new Map<string, number>();
  const categoryCache = new Map<string, number>();
  const subCategoryCache = new Map<string, number>();
  const unitCache = new Map<string, number>();
  const attributeCache = new Map<string, number>();

  for (const row of rows) {
    try {
      await db.transaction(async (tx) => {
        // 2. Resolve Relationships
        
        // Brand
        let brandId: number | null = null;
        if (row.Brand) {
          const brandName = row.Brand.trim();
          if (brandCache.has(brandName)) {
            brandId = brandCache.get(brandName)!;
          } else {
            const [existingBrand] = await tx.select().from(brands).where(eq(brands.name, brandName)).limit(1);
            if (existingBrand) {
              brandId = existingBrand.id;
            } else {
              const [newBrand] = await tx.insert(brands).values({ name: brandName }).returning();
              brandId = newBrand.id;
            }
            brandCache.set(brandName, brandId);
          }
        }

        // Category
        let categoryId: number | null = null;
        if (row.Category) {
          const catName = row.Category.trim();
          if (categoryCache.has(catName)) {
            categoryId = categoryCache.get(catName)!;
          } else {
            const [existingCat] = await tx.select().from(categories).where(eq(categories.name, catName)).limit(1);
            if (existingCat) {
              categoryId = existingCat.id;
            } else {
              const [newCat] = await tx.insert(categories).values({ name: catName }).returning();
              categoryId = newCat.id;
            }
            categoryCache.set(catName, categoryId);
          }
        }

        // Subcategory
        let subCategoryId: number | null = null;
        if (row.Subcategory && categoryId) {
          const subName = row.Subcategory.trim();
          const subKey = `${categoryId}:${subName}`;
          if (subCategoryCache.has(subKey)) {
            subCategoryId = subCategoryCache.get(subKey)!;
          } else {
            const [existingSub] = await tx.select()
              .from(subCategories)
              .where(and(eq(subCategories.name, subName), eq(subCategories.categoryId, categoryId)))
              .limit(1);
            if (existingSub) {
              subCategoryId = existingSub.id;
            } else {
              const [newSub] = await tx.insert(subCategories).values({ 
                name: subName, 
                categoryId: categoryId 
              }).returning();
              subCategoryId = newSub.id;
            }
            subCategoryCache.set(subKey, subCategoryId);
          }
        }

        // Unit
        let unitId: number | null = null;
        if (row.Unit) {
          const unitName = row.Unit.trim();
          if (unitCache.has(unitName)) {
            unitId = unitCache.get(unitName)!;
          } else {
            const [existingUnit] = await tx.select().from(units).where(eq(units.name, unitName)).limit(1);
            if (existingUnit) {
              unitId = existingUnit.id;
            } else {
              const [newUnit] = await tx.insert(units).values({ name: unitName }).returning();
              unitId = newUnit.id;
            }
            unitCache.set(unitName, unitId);
          }
        }

        // 3. Create Product
        const [product] = await tx.insert(products).values({
          name: row['Product Name'],
          categoryId,
          subCategoryId,
          brandId,
          unitId,
          description: row.Description,
          price: row.Price.toString(),
          costPrice: row['Cost Price']?.toString(),
          sku: row.SKU,
          stockQuantity: row.Stock || 0,
          status: 'Active'
        }).returning();

        // 4. Create Main Variant
        await tx.insert(productVariants).values({
          productId: product.id,
          name: row['Product Name'],
          sku: row.SKU,
          price: row.Price.toString(),
          costPrice: row['Cost Price']?.toString(),
          status: 'Active'
        });

        // 5. Handle Specifications
        if (row.Specifications) {
          const specs = row.Specifications.split(';').map(s => s.trim());
          for (const spec of specs) {
            const [key, value] = spec.split(':').map(s => s.trim());
            if (key && value) {
              const attrKey = `${categoryId || 0}:${key}`;
              let attributeId: number;

              if (attributeCache.has(attrKey)) {
                attributeId = attributeCache.get(attrKey)!;
              } else {
                let [attr] = await tx.select()
                  .from(categoryAttributes)
                  .where(and(
                    eq(categoryAttributes.name, key), 
                    categoryId ? eq(categoryAttributes.categoryId, categoryId) : sql`TRUE`
                  ))
                  .limit(1);
                
                if (!attr && categoryId) {
                  [attr] = await tx.insert(categoryAttributes).values({
                    categoryId,
                    name: key,
                    dataType: 'string'
                  }).returning();
                }

                if (attr) {
                  attributeId = attr.id;
                  attributeCache.set(attrKey, attributeId);
                } else {
                  continue; 
                }
              }

              await tx.insert(productAttributeValues).values({
                productId: product.id,
                attributeId: attributeId,
                value: value
              });
            }
          }
        }
      });
      results.success++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`Row "${row['Product Name']}": ${err.message}`);
    }
  }

  return results;
}

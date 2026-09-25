'use server';

import { seedProductsFromExcel } from './excel-seeder';
import { revalidatePath } from 'next/cache';

export async function uploadProductsExcel(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file uploaded');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const results = await seedProductsFromExcel(buffer);

  revalidatePath('/products');
  
  return results;
}

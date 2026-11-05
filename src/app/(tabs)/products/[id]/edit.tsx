import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { ImageChange } from '@/components/image-field';
import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { productChanges } from '@/features/products/api';
import { ProductForm } from '@/features/products/components/product-form';
import {
  useProduct,
  useRemoveProductImage,
  useUpdateProduct,
  useUploadProductImage,
} from '@/features/products/hooks';
import { productFormValues, type ProductInput } from '@/features/products/schemas';
import { mn } from '@/i18n/mn';
import { getErrorMessage } from '@/lib/errors';
import { goBack } from '@/lib/navigation';
import { assetUrl } from '@/lib/storage';
import type { Product } from '@/types/models';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);

  return (
    <Screen>
      <Stack.Screen options={{ title: mn.products.editTitle }} />
      {product.isPending ? (
        <LoadingState />
      ) : product.isError ? (
        <ErrorState message={getErrorMessage(product.error)} onRetry={() => product.refetch()} />
      ) : (
        <EditProductForm product={product.data} />
      )}
    </Screen>
  );
}

function EditProductForm({ product }: { product: Product }) {
  const updateProduct = useUpdateProduct();
  const uploadImage = useUploadProductImage();
  const removeImage = useRemoveProductImage();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: ProductInput, image: ImageChange) {
    setError(null);
    try {
      const updated = await updateProduct.mutateAsync({
        id: product.id,
        changes: productChanges(values),
      });
      if (image) await uploadImage.mutateAsync({ product: updated, image });
      else if (image === null && updated.image_path) await removeImage.mutateAsync(updated);
      goBack({ pathname: '/products/[id]', params: { id: product.id } });
      return true;
    } catch (e) {
      setError(getErrorMessage(e));
      return false;
    }
  }

  return (
    <ProductForm
      defaultValues={productFormValues(product)}
      currentImageUrl={product.image_path ? assetUrl(product.image_path) : null}
      submitLabel={mn.common.save}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}

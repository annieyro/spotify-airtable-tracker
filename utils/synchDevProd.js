/* eslint-disable import/prefer-default-export */
// Example code from DC Central Kitchen

// import { createManyProducts, createManyStores, getAllProducts as getAllProdProducts, getAllStores as getAllProdStores, updateManyProducts as updateManyProdProducts, updateManyStores as updateManyProdStores } from '../lib/airtable-prod/request';
// import { getAllProducts as getAllDevProducts, getAllStores as getAllDevStores } from '../lib/airtable/request';

// Helper to port data from DEV to PROD
const getProductFields = (record) => {
  // Primary Keys, ID, and foreign keys do not persist across bases
  // Neither do computed values
  // Easier to whitelist for Products table
  const product = {
    category: record.category,
    name: record.name,
    detail: record.detail,
    customerCost: record.customerCost,
  };
  return product;
};

// Helper to port data from DEV to PROD
const getStoreFields = (record) => {
  // Primary Keys, ID, and foreign keys do not persist across bases
  // Neither do computed values
  const {
    primaryKey,
    id,
    productIds,
    clerkIds,
    transactionIds,
    ...desired
  } = record;
  return desired;
};

// Creates new products & stores if missing in PROD but exists in DEV
const createIfMissing = async () => {
  // TODO extract this to helper function for create for one table
  const devProducts = await getAllDevProducts();
  const devStores = await getAllDevStores();

  const prodProducts = await getAllProdProducts();
  const prodStores = await getAllProdStores();

  // Find records that exist in DEV but not PROD
  const prodMissingProducts = devProducts
    .filter(
      (prodStore) =>
        !prodProducts.find((record) => record.fullName === prodStore.fullName)
    )
    .map(getProductFields);

  const prodMissingStores = devStores
    .filter(
      (prodStore) =>
        !prodStores.find((record) => record.storeName === prodStore.storeName)
    )
    .map(getStoreFields);

  // Create records for missing Products and Stores
  const newProductIds = await createManyProducts(prodMissingProducts);
  const newStoreIds = await createManyStores(prodMissingStores);

  // Useful logging
  console.log('Products Missing in [PROD] Airtable: ');
  console.log(
    prodMissingProducts.map((record) =>
      record.name.concat(', ').concat(record.detail)
    )
  );

  console.log('Stores Missing in [PROD] Airtable: ');
  console.log(prodMissingStores.map((record) => record.storeName));

  if (newProductIds.length > 0) console.log('[newProductIds]: ', newProductIds);
  if (newStoreIds.length > 0) console.log('[newStoreIds]: ', newStoreIds);

  return newProductIds.concat(newStoreIds);
};

// Update all product records from DEV to PROD
// Update all store records from DEV to PROD
// Currently DOES NOT update linked records; use `updateStoreProducts` from a CSV for that
const updateAllDevProdInfo = async () => {
  // TODO extract to helper function to update for one table
  const devProducts = await getAllDevProducts();
  const devStores = await getAllDevStores();

  const prodProducts = await getAllProdProducts();
  const prodStores = await getAllProdStores();

  const updatedProductNames = [];
  const updatedStoreNames = [];

  const products = devProducts
    .map((devRecord) => {
      const prodId = prodProducts.find(
        (prodRecord) => prodRecord.fullName === devRecord.fullName
      ).id;
      // Only want to update the ID
      return { ...devRecord, id: prodId };
    })
    .map((newRecord) => {
      updatedProductNames.push(`${newRecord.name}, ${newRecord.detail}`);
      return {
        id: newRecord.id,
        fields: getProductFields(newRecord),
      };
    });

  const stores = devStores
    .map((devRecord) => {
      const prodId = prodStores.find(
        (prodRecord) => prodRecord.storeName === devRecord.storeName
      ).id;
      // Only want to update the ID
      return { ...devRecord, id: prodId };
    })
    .map((newRecord) => {
      updatedStoreNames.push(newRecord.storeName);
      return { id: newRecord.id, fields: getStoreFields(newRecord) };
    });

  // Useful logging
  // Everything gets updated right now, so not really useful LOL
  //   console.log('Updated products in [PROD]: ', updatedProductNames);
  //   console.log('Updated stores in [PROD]: ', updatedStoreNames);
  const updatedProductIds = await updateManyProdProducts(products);
  const updatedStoreIds = await updateManyProdStores(stores);
  return {
    updatedProductNames,
    updatedProductIds,
    updatedStoreNames,
    updatedStoreIds,
  };
};

// Updates per-record details from DEV to PROD
// Currently DOES NOT update linked records; use `updateStoreProducts` from a CSV for that
export const synchDevProd = async () => {
  // Copy all records from DEV Stores / Products to PROD, first creating records if missing
  const newIds = await createIfMissing();
  const {
    updatedProductNames,
    updatedProductIds,
    updatedStoreNames,
    updatedStoreIds,
  } = await updateAllDevProdInfo();
  return {
    newIds,
    updatedProductNames,
    updatedProductIds,
    updatedStoreNames,
    updatedStoreIds,
  };
};

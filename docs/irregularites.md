* Fact that SKU exists in catalog but absent in inventory.
The reason :
It usually happens when someone runs product seed/create (seedRandomProductsAction) but does not run inventory seed (seedInventoryFromCatalogAction in inventory-actions.ts (line 210)).
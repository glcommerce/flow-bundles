use serde::{Deserialize, Serialize};
use shopify_function::{Money, Sale};

#[derive(Debug, Deserialize, Serialize)]
pub struct BundleConfig {
    pub bundle_type: String,
    #[serde(rename = "discountType")]
    pub discount_type: String,
    #[serde(rename = "discountValue")]
    pub discount_value: f64,
    #[serde(rename = "minQuantity")]
    pub min_quantity: u64,
    #[serde(rename = "productIds")]
    pub product_ids: Vec<String>,
    #[serde(rename = "collectionIds")]
    pub collection_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct DiscountLine {
    #[serde(rename = "lineId")]
    pub line_id: Option<String>,
    pub quantity: Option<u64>,
    pub discount: Sale,
}

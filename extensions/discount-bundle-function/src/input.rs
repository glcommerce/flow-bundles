use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Input {
    pub cart: Option<Cart>,
    pub discount_node: Option<DiscountNode>,
}

#[derive(Debug, Deserialize)]
pub struct Cart {
    pub lines: Vec<CartLine>,
}

#[derive(Debug, Deserialize)]
pub struct CartLine {
    pub id: String,
    pub quantity: u64,
    pub merchandise: Option<Merchandise>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "__typename")]
pub enum Merchandise {
    ProductVariant(ProductVariant),
}

#[derive(Debug, Deserialize)]
pub struct ProductVariant {
    pub id: String,
    pub product: Option<Product>,
    pub price: Price,
}

#[derive(Debug, Deserialize)]
pub struct Product {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct Price {
    pub amount: Number,
    #[serde(rename = "currencyCode")]
    pub currency_code: String,
}

#[derive(Debug, Deserialize)]
pub struct DiscountNode {
    pub metafield: Option<Metafield>,
}

#[derive(Debug, Deserialize)]
pub struct Metafield {
    pub value: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Number {
    String(String),
    Float(f64),
}

impl Number {
    pub fn as_f64(&self) -> f64 {
        match self {
            Number::String(s) => s.parse().unwrap_or(0.0),
            Number::Float(f) => *f,
        }
    }
}

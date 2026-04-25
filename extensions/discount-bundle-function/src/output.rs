use crate::discount::DiscountLine;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Output {
    pub discounts: Vec<DiscountLine>,
}

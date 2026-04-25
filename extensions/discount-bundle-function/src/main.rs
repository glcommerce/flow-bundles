mod input;
mod output;
mod discount;
mod tests;

use input::{CartLine, Input, Merchandise};
use output::Output;
use discount::{BundleConfig, DiscountLine};

use shopify_function::prelude::*;
use shopify_function::Sale;

#[shopify_function]
fn main(input: Input) -> Output {
    let bundle_config = match parse_bundle_config(&input) {
        Some(config) => config,
        None => {
            log::info!("No bundle config found, skipping");
            return Output { discounts: vec![] }
        }
    };

    log::info!("Bundle config: {:?}", bundle_config);

    let cart_lines = match &input.cart {
        Some(cart) => &cart.lines,
        None => {
            log::info!("No cart found");
            return Output { discounts: vec![] }
        }
    };

    // Find eligible products
    let eligible_lines: Vec<&CartLine> = cart_lines
        .iter()
        .filter(|line| {
            if let Some(merchandise) = &line.merchandise {
                match merchandise {
                    Merchandise::ProductVariant(pv) => {
                        if let Some(product) = &pv.product {
                            // Check product ID filter (empty means all products)
                            let product_match = bundle_config.product_ids.is_empty() ||
                                bundle_config.product_ids.iter().any(|id| product.id.contains(id));
                            product_match
                        } else {
                            false
                        }
                    }
                }
            } else {
                false
            }
        })
        .collect();

    if eligible_lines.is_empty() {
        log::info!("No eligible items found");
        return Output { discounts: vec![] };
    }

    // Check if we have enough items for the bundle
    let total_quantity: u64 = eligible_lines.iter().map(|l| l.quantity).sum();

    if total_quantity < bundle_config.min_quantity {
        log::info!("Insufficient quantity: {} < {}", total_quantity, bundle_config.min_quantity);
        return Output { discounts: vec![] };
    }

    // Calculate total price of exactly minQuantity items
    let mut total_price: f64 = 0.0;
    let mut remaining_quantity = bundle_config.min_quantity;

    for line in &eligible_lines {
        if remaining_quantity == 0 {
            break;
        }

        let qty_to_count = remaining_quantity.min(line.quantity);

        if let Some(merchandise) = &line.merchandise {
            if let Merchandise::ProductVariant(pv) = merchandise {
                let price = pv.price.amount.as_f64();
                total_price += price * qty_to_count as f64;
                remaining_quantity -= qty_to_count;
            }
        }
    }

    log::info!("Total price of {} items: ${:.2}", bundle_config.min_quantity, total_price);

    // Calculate discount based on discountType
    let discount_amount = match bundle_config.discount_type.as_str() {
        "percentage" => {
            // discount = product_sum * (discountValue / 100)
            let pct = bundle_config.discount_value / 100.0;
            total_price * pct
        }
        "fixed_amount" | _ => {
            // discount = product_sum - discountValue (only if product_sum >= discountValue)
            if total_price < bundle_config.discount_value {
                log::info!("Bundle price ({}) higher than product sum ({}), no discount",
                    bundle_config.discount_value, total_price);
                return Output { discounts: vec![] };
            }
            total_price - bundle_config.discount_value
        }
    };

    log::info!("Discount amount: ${:.2}", discount_amount);

    // Build the discount output - distribute discount proportionally
    let all_eligible_quantity: u64 = eligible_lines.iter().map(|l| l.quantity).sum();

    let discounts: Vec<DiscountLine> = eligible_lines
        .iter()
        .map(|line| {
            let line_total = match &line.merchandise {
                Some(merchandise) => {
                    if let Merchandise::ProductVariant(pv) = merchandise {
                        pv.price.amount.as_f64() * line.quantity as f64
                    } else {
                        0.0
                    }
                }
                None => 0.0,
            };

            // Proportional discount: each line gets discount proportional to its value
            // line_discount_ratio = line's total value / total value of all eligible items
            let line_discount_ratio = if total_price > 0.0 && all_eligible_quantity > 0 {
                line_total / (total_price * (all_eligible_quantity as f64 / bundle_config.min_quantity as f64))
            } else {
                0.0
            };
            let line_discount = discount_amount * line_discount_ratio;

            let currency = match &line.merchandise {
                Some(Merchandise::ProductVariant(pv)) => pv.price.currency_code.clone(),
                None => "USD".to_string(),
            };

            DiscountLine {
                line_id: Some(line.id.clone()),
                quantity: Some(line.quantity),
                discount: Sale {
                    message: Some(format!("Bundle: {} items for ${}", bundle_config.min_quantity, bundle_config.discount_value)),
                    amount: Money {
                        amount: line_discount.into(),
                        currency_code: currency,
                    },
                    conditions: vec![],
                },
            }
        })
        .collect();

    Output { discounts }
}

fn parse_bundle_config(input: &Input) -> Option<BundleConfig> {
    let metafield = input.discount_node.as_ref()?.metafield.as_ref()?;
    let value = metafield.value.as_ref()?;

    log::info!("Metafield value: {}", value);

    serde_json::from_str(value).ok()
}

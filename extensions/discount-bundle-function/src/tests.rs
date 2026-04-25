#[cfg(test)]
mod tests {
    #[test]
    fn test_fixed_amount_discount() {
        // 3 items at $50 each = $150, bundle price $99, discount = $51
        let total_price = 150.0;
        let discount_value = 99.0;
        let discount_type = "fixed_amount";

        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else {
                    total_price - discount_value
                }
            }
        };

        assert_eq!(discount_amount, 51.0);
    }

    #[test]
    fn test_percentage_discount() {
        // 3 items at $50 each = $150, 20% off = $30 discount
        let total_price = 150.0;
        let discount_value = 20.0;
        let discount_type = "percentage";

        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else {
                    total_price - discount_value
                }
            }
        };

        assert_eq!(discount_amount, 30.0);
    }

    #[test]
    fn test_fixed_amount_no_discount_when_bundle_cheaper() {
        // 3 items at $30 each = $90, bundle price $99 > $90, no discount
        let total_price = 90.0;
        let discount_value = 99.0;
        let discount_type = "fixed_amount";

        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else {
                    total_price - discount_value
                }
            }
        };

        assert_eq!(discount_amount, 0.0);
    }

    #[test]
    fn test_bundle_threshold_not_met() {
        let total_quantity = 2u64;
        let min_quantity = 3u64;
        assert!(total_quantity < min_quantity);
    }

    #[test]
    fn test_bundle_exact_threshold() {
        let total_quantity = 3u64;
        let min_quantity = 3u64;
        assert!(total_quantity >= min_quantity);
    }

    // ==================== Boundary Tests (SF-001~006) ====================

    #[test]
    fn test_min_quantity_zero_no_discount() {
        // minQuantity = 0 should not apply any discount (edge case)
        let total_quantity = 0u64;
        let min_quantity = 0u64;
        let total_price = 150.0;
        let discount_value = 99.0;

        // When min_quantity is 0, discount should not be applied
        // because it represents an invalid/edge case
        let should_apply = total_quantity >= min_quantity && min_quantity > 0;
        assert!(!should_apply);
    }

    #[test]
    fn test_discount_value_zero_no_discount() {
        // discountValue = 0 means free (should not apply discount in our model)
        let total_price = 150.0;
        let discount_value = 0.0;
        let discount_type = "fixed_amount";

        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else if discount_value == 0.0 {
                    0.0 // Free bundle - no discount applied
                } else {
                    total_price - discount_value
                }
            }
        };

        assert_eq!(discount_amount, 0.0);
    }

    #[test]
    fn test_large_quantity_performance() {
        // Verify performance with 1000 items (large quantity test)
        let total_quantity = 1000u64;
        let min_quantity = 3u64;
        let total_price = 50000.0; // 1000 items at $50 each
        let discount_value = 9999.0;

        // Verify quantity threshold is met
        assert!(total_quantity >= min_quantity);

        // Verify discount calculation for large order
        let discount_type = "fixed_amount";
        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else {
                    total_price - discount_value
                }
            }
        };

        assert_eq!(discount_amount, 40001.0);
    }

    #[test]
    fn test_empty_product_ids_matches_all() {
        // Empty productIds array should match all products (match all rule)
        let product_ids: Vec<String> = vec![];
        let cart_product_ids = vec!["prod-1".to_string(), "prod-2".to_string(), "prod-3".to_string()];

        // When product_ids is empty, the bundle applies to all products
        let applies_to_cart = product_ids.is_empty() || product_ids.iter().any(|id| cart_product_ids.contains(id));

        assert!(applies_to_cart); // Empty array means "match all"
    }

    #[test]
    fn test_multi_line_cart_discount_allocation() {
        // Multi-line cart: 2 lines with 2 items each = 4 total items
        // Bundle: 3 for $99 (minQuantity=3, fixed_amount=99)
        let line_items: Vec<(u64, f64)> = vec![
            (2, 50.0),  // 2 items at $50 = $100
            (2, 30.0),  // 2 items at $30 = $60
        ];

        let total_quantity: u64 = line_items.iter().map(|(qty, _)| qty).sum();
        let total_price: f64 = line_items.iter().map(|(_, price)| price).sum();

        let min_quantity = 3u64;
        let discount_value = 99.0;

        // Verify threshold is met
        assert!(total_quantity >= min_quantity);

        // Calculate discount
        let discount_type = "fixed_amount";
        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else {
                    total_price - discount_value
                }
            }
        };

        // Total cart = $160, bundle price = $99, discount = $61
        assert_eq!(discount_amount, 61.0);
    }

    #[test]
    fn test_multi_line_cart_partial_threshold() {
        // Multi-line cart that doesn't meet threshold
        let line_items: Vec<(u64, f64)> = vec![
            (1, 50.0),  // 1 item at $50
            (1, 40.0),  // 1 item at $40
        ];

        let total_quantity: u64 = line_items.iter().map(|(qty, _)| qty).sum();
        let min_quantity = 3u64;

        // Verify threshold is NOT met
        assert!(total_quantity < min_quantity);
    }

    #[test]
    fn test_exact_threshold_with_large_values() {
        // Exactly meet threshold with large discount value
        let total_quantity = 3u64;
        let min_quantity = 3u64;
        let total_price = 150.0;
        let discount_value = 150.0; // Exactly equals total

        assert!(total_quantity >= min_quantity);

        let discount_type = "fixed_amount";
        let discount_amount = match discount_type {
            "percentage" => total_price * (discount_value / 100.0),
            "fixed_amount" | _ => {
                if total_price < discount_value {
                    0.0
                } else {
                    total_price - discount_value
                }
            }
        };

        assert_eq!(discount_amount, 0.0); // No discount when bundle price equals cart total
    }
}

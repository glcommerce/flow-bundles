import { extension } from '@shopify/ui-extensions';

export default extension('product-pdp.block.render', (root, { extend }) => {
  root.appendChild(
    root.createComponent('View', { padding: '16px', border: '1px solid #e3e3e3', borderRadius: '12px', margin: '16px 0' }, [
      // Header
      root.createComponent('InlineLayout', { gap: '8px', inlineAlignment: 'center' }, [
        root.createComponent('Text', { variant: 'headingSm' }, '🎁 Buy Bundle, Save More')
      ])
    ])
  );
});
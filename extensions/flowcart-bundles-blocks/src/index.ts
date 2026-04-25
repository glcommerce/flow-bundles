import extension from '@shopify/ui-extensions-server-side';

export default extension('product-pdp.block.render', (root, { block }) => {
  root.appendChild(
    root.createComponent('View', {
      style: {
        padding: '16px',
        border: '1px solid #e3e3e3',
        borderRadius: '12px',
        margin: '16px 0',
        backgroundColor: '#fff'
      }
    }, [
      root.createComponent('Text', {
        variant: 'headingSm',
        children: '🎁 Buy Bundle, Save More'
      })
    ])
  );
});
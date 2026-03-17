document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.woocommerce-pagination');

    if (container) {
        container.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (!link) {
                return;
            }

            e.preventDefault();

            const match = link.href.match(/page\/(\d+)/);
            const paged = match ? parseInt(match[1]) : 1;

            fetch(ajax_vars.ajaxurl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'my_filter',
                    paged: paged,
                }),
            })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                document.querySelector('.woof_products_loop').innerHTML = res.data.html;
            }
            });
        });
    }
});
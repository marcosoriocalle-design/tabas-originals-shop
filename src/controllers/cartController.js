export const renderCart = (req, res) => {
    res.render('pages/cart', {
        title: 'Mi Carrito | tabas ORIGINALS',
        cartItems: []
    });
};

export const renderCheckout = (req, res) => {
    res.render('pages/checkout', {
        title: 'Finalizar Compra | tabas ORIGINALS'
    });
};

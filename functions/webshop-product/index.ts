import axios from 'axios';

type Context = {
    req: any;
    res: any;
    log: (msg: any) => void;
    error: (msg: any) => void;
};

interface Product {
    id: number;
    name: string;
    campus: { value: string; label: string };
    department: { value: string; label: string };
    images: string[];
    price: string;
    sale_price: string;
    description: string;
    url: string;
}

export default async ({ req, res, log, error }: Context) => {
    log('Request received');

    // Get product ID from request body
    log("Request body: " + JSON.stringify(req.body));
   const productId = req.body
    try {
        // Fetch specific product from WooCommerce API
        const response = await axios.get(`https://biso.no/wp-json/wc/v3/products/${productId}`, {
            params: {
                consumer_key: process.env.WC_CONSUMER_KEY,
                consumer_secret: process.env.WC_CONSUMER_SECRET,
            },
        });

        const product = response.data;
        log(`Product fetched: ${JSON.stringify(product)}`);
        // Transform the product data to match your interface
        const transformedProduct: Product = {
            id: product.id,
            name: product.name,
            campus: product.acf?.campus || { value: '', label: 'N/A' },
            department: product.acf?.department || { value: '', label: 'N/A' },
            images: product.images.map((img: any) => img.src),
            price: product.price,
            sale_price: product.sale_price,
            description: product.description,
            url: product.permalink,
        };
        log(`Transformed product: ${JSON.stringify(transformedProduct)}`);
        return res.json({ product: transformedProduct });
    } catch (err: any) {
        error(`Error during product retrieval: ${err.message}`);
        if (err.response?.status === 404) {
            return res.json({ message: 'Product not found' });
        }

        error(`Failed to fetch product from WooCommerce: ${err.message}`);
        return res.json({ message: 'Failed to fetch product' });
    }
};
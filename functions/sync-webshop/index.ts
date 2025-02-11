import axios from 'axios';
import { Product, ResponseData, Context } from '@biso/types';



export default async ({ req, res, log, error }: Context) => {
    log('Request received');


    // Parse campus and department filters
    let campus, department;
    try {
        ({ campus, department } = JSON.parse(req.body) || {});
    } catch (err) {
        log('Error parsing request body');
        return res.json({ message: 'Invalid request body' });
    }

    try {
        // Fetch products from WooCommerce API
        const response = await axios.get('https://biso.no/wp-json/wc/v3/products', {
            params: {
                consumer_key: process.env.WC_CONSUMER_KEY,
                consumer_secret: process.env.WC_CONSUMER_SECRET,
            },
        });

        // Process and filter products
        const products = response.data
            .map((product: any) => ({
                id: product.id,
                name: product.name,
                campus: product.acf?.campus || { value: '', label: 'N/A' },
                department: product.acf?.department || { value: '', label: 'N/A' },
                images: product.images.map((img: any) => img.src),
                price: product.price,
                sale_price: product.sale_price,
                description: product.description,
                url: product.permalink,
            }))
            .filter((product: Product) => {
                const campusMatch = campus ? product.campus.value === campus : true;
                const departmentMatch = department ? product.department.value === department : true;
                return campusMatch && departmentMatch;
            });

        return res.json({ products });
    } catch (err: any) {
        error(`Failed to fetch products from WooCommerce: ${err.message}`);
        return res.json({ message: 'Failed to fetch products' });
    }
};
import { faker } from "@faker-js/faker";
import type { Supplier } from "./suppliers.js";


export class Material {
    readonly material_code: string;
    readonly material_name: string;
    readonly supplier_code: string;
    readonly supplier_name: string;

    constructor(suppliers:Supplier[]) {
        this.material_code = `${faker.string.alpha({ length: 4, casing: 'upper'})}-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`; 
        this.material_name = faker.commerce.productName();

        const randomSupplier:Supplier = faker.helpers.arrayElement(suppliers);
        this.supplier_code = randomSupplier.supplier_code;
        this.supplier_name = randomSupplier.supplier_name; 
    }


    static CSV_HEADER = 'material_code,material_name,supplier_code,supplier_name';
    
    public asCsv(): string {
        return `"${this.material_code}","${this.material_name}","${this.supplier_code}","${this.supplier_name}"`;
    }
}

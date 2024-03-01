import { faker } from "@faker-js/faker";


export class Supplier {
    readonly supplier_code: string;
    readonly supplier_name: string;

    constructor() {
        this.supplier_code = faker.string.hexadecimal({ prefix: 'SUP', length: 6, casing: 'upper' });
        this.supplier_name = faker.company.name(); 
    }
}

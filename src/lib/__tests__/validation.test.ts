import { validateBrandInput, brandSchema } from "../validation";

describe("validation", () => {
    describe("brandSchema", () => {
        it("should accept valid brand names", () => {
            const validBrands = [
                "Apple",
                "Nike",
                "Coca-Cola",
                "Johnson & Johnson",
                "Ben's Cafe",
                "Brand 123",
                "L.L. Bean",
            ];

            validBrands.forEach((brand) => {
                const result = brandSchema.safeParse({ brand });
                expect(result.success).toBe(true);
            });
        });

        it("should reject empty brand names", () => {
            const result = brandSchema.safeParse({ brand: "" });
            expect(result.success).toBe(false);
        });

        it("should reject brand names over 100 characters", () => {
            const longBrand = "A".repeat(101);
            const result = brandSchema.safeParse({ brand: longBrand });
            expect(result.success).toBe(false);
        });

        it("should reject brand names with special characters", () => {
            const invalidBrands = [
                "<script>",
                "Brand@email.com",
                "Brand#hashtag",
                "Brand$money",
            ];

            invalidBrands.forEach((brand) => {
                const result = brandSchema.safeParse({ brand });
                expect(result.success).toBe(false);
            });
        });

        it("should trim whitespace", () => {
            const result = brandSchema.safeParse({ brand: "  Apple  " });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.brand).toBe("Apple");
            }
        });
    });

    describe("validateBrandInput", () => {
        it("should return success for valid input", () => {
            const result = validateBrandInput({ brand: "Apple" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.brand).toBe("Apple");
            }
        });

        it("should return error for invalid input", () => {
            const result = validateBrandInput({ brand: "" });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeDefined();
            }
        });

        it("should handle missing brand property", () => {
            const result = validateBrandInput({});
            expect(result.success).toBe(false);
        });

        it("should handle non-object input", () => {
            const result = validateBrandInput("Apple");
            expect(result.success).toBe(false);
        });
    });
});

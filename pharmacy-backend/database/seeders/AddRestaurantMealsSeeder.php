<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Category;
use App\Models\Meal;
use App\Models\MealOption;

class AddRestaurantMealsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        // إنشاء الأقسام الرئيسية إذا لم تكن موجودة
        $mealsCategory = Category::firstOrCreate(
            ['name' => 'الوجبات', 'parent_id' => null],
            ['scope' => 'sales', 'description' => 'الوجبات الرئيسية']
        );

        $saladsCategory = Category::firstOrCreate(
            ['name' => 'السلطات', 'parent_id' => null],
            ['scope' => 'sales', 'description' => 'السلطات والمقبلات']
        );

        $fastFoodCategory = Category::firstOrCreate(
            ['name' => 'الوجبات السريعة', 'parent_id' => null],
            ['scope' => 'sales', 'description' => 'الوجبات السريعة والشطائر']
        );

        $drinksCategory = Category::firstOrCreate(
            ['name' => 'المشروبات', 'parent_id' => null],
            ['scope' => 'sales', 'description' => 'المشروبات والعصائر']
        );

        // إضافة الوجبات
        $meals = [
            ['name' => 'كباب', 'price' => 25.00],
            ['name' => 'شيش', 'price' => 25.00],
            ['name' => 'طاووق', 'price' => 20.00],
            ['name' => 'ستيك دجاج', 'price' => 30.00],
            ['name' => 'قدر', 'price' => 35.00],
            ['name' => 'شاورما', 'price' => 15.00],
            ['name' => 'دبابيس', 'price' => 18.00],
            ['name' => 'جناح', 'price' => 22.00],
            ['name' => 'جاج', 'price' => 20.00],
            ['name' => 'رز', 'price' => 8.00],
            ['name' => 'مندي', 'price' => 25.00],
            ['name' => 'تايلندي', 'price' => 28.00],
        ];

        foreach ($meals as $meal) {
            Meal::firstOrCreate(
                ['name' => $meal['name'], 'category_id' => $mealsCategory->id],
                [
                    'sale_price' => $meal['price'],
                    'cost_price' => $meal['price'] * 0.6, // تقدير تكلفة
                    'is_available' => true,
                    'fixed_price' => true,
                ]
            );
        }

        // إضافة السلطات
        $salads = [
            ['name' => 'ملفوف أحمر', 'price' => 5.00],
            ['name' => 'ملفوف أبيض', 'price' => 5.00],
            ['name' => 'ملفوف دره', 'price' => 6.00],
            ['name' => 'سلطة بالخيار', 'price' => 7.00],
            ['name' => 'تركية', 'price' => 8.00],
            ['name' => 'تومية', 'price' => 6.00],
            ['name' => 'بصل بالسماق', 'price' => 4.00],
        ];

        foreach ($salads as $salad) {
            // إنشاء خيارات للحجم
            $meal = Meal::firstOrCreate(
                ['name' => $salad['name'], 'category_id' => $saladsCategory->id],
                [
                    'sale_price' => 0, // سيتم تحديد السعر من الخيارات
                    'cost_price' => $salad['price'] * 0.5,
                    'is_available' => true,
                    'fixed_price' => false,
                ]
            );

            // إضافة خيارات الأحجام
            if (!$meal->options()->exists()) {
                $meal->options()->createMany([
                    ['name' => 'صحن صغير', 'price' => $salad['price'], 'group_name' => 'الحجم', 'sort_order' => 1, 'is_active' => true],
                    ['name' => 'صحن كبير', 'price' => $salad['price'] * 1.5, 'group_name' => 'الحجم', 'sort_order' => 2, 'is_active' => true],
                    ['name' => 'علبة صغيرة', 'price' => $salad['price'] * 0.8, 'group_name' => 'الحجم', 'sort_order' => 3, 'is_active' => true],
                    ['name' => 'علبة كبيرة', 'price' => $salad['price'] * 1.2, 'group_name' => 'الحجم', 'sort_order' => 4, 'is_active' => true],
                ]);
            }
        }

        // إضافة الوجبات السريعة
        $fastFoods = [
            ['name' => 'فراشيح كباب عادي', 'price' => 12.00],
            ['name' => 'فراشيح كباب دبل', 'price' => 18.00],
            ['name' => 'فراشيح كباب دبل دبل', 'price' => 24.00],
            ['name' => 'فراشيح شيش عادي', 'price' => 12.00],
            ['name' => 'فراشيح شيش دبل', 'price' => 18.00],
            ['name' => 'فراشيح شيش دبل دبل', 'price' => 24.00],
            ['name' => 'فراشيح جناح', 'price' => 15.00],
            ['name' => 'عرايس', 'price' => 10.00],
            ['name' => 'تايلندي', 'price' => 14.00],
        ];

        foreach ($fastFoods as $fastFood) {
            Meal::firstOrCreate(
                ['name' => $fastFood['name'], 'category_id' => $fastFoodCategory->id],
                [
                    'sale_price' => $fastFood['price'],
                    'cost_price' => $fastFood['price'] * 0.6,
                    'is_available' => true,
                    'fixed_price' => true,
                ]
            );
        }

        // إضافة المشروبات
        $drinks = [
            ['name' => 'كولا', 'price' => 3.00],
            ['name' => 'سفن', 'price' => 3.00],
        ];

        foreach ($drinks as $drink) {
            Meal::firstOrCreate(
                ['name' => $drink['name'], 'category_id' => $drinksCategory->id],
                [
                    'sale_price' => $drink['price'],
                    'cost_price' => $drink['price'] * 0.4,
                    'is_available' => true,
                    'fixed_price' => true,
                ]
            );
        }
    }
}

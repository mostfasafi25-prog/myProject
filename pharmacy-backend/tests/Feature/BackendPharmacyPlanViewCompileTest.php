<?php

namespace Tests\Feature;

use Illuminate\View\Compilers\BladeCompiler;
use Tests\TestCase;

/**
 * Regression: inline @php(...) breaks Blade when the expression contains ")" (e.g. config(), nested calls).
 * The compiled PHP then leaves raw @foreach/@endif and triggers ParseError at endforeach.
 */
class BackendPharmacyPlanViewCompileTest extends TestCase
{
    public function test_pharmacy_plan_blade_compiles_to_parseable_php(): void
    {
        /** @var BladeCompiler $compiler */
        $compiler = $this->app->make('blade.compiler');
        $path = resource_path('views/backend/pharmacy-plan.blade.php');

        $compiler->compile($path);
        $compiledPath = $compiler->getCompiledPath($path);

        $this->assertFileExists($compiledPath);

        $output = [];
        $exitCode = 1;
        exec('php -l '.escapeshellarg($compiledPath).' 2>&1', $output, $exitCode);

        $this->assertSame(0, $exitCode, implode("\n", $output));
    }
}

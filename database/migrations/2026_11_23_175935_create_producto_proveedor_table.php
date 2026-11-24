<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Tabla intermedia (pivot) de la relación N:M entre productos y proveedores
    public function up(): void
    {
        Schema::create('producto_proveedor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('proveedor_id')->constrained('proveedores')->cascadeOnDelete();

            // Datos propios de la relación (lo que cuesta ESE producto con ESE proveedor)
            $table->decimal('precio_costo', 10, 2);
            $table->string('codigo_proveedor', 40)->nullable();

            $table->timestamps();

            // Un producto no puede vincularse dos veces con el mismo proveedor
            $table->unique(['producto_id', 'proveedor_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('producto_proveedor');
    }
};
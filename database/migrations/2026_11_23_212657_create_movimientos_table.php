<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimientos', function (Blueprint $table) {
            $table->id();

            // Si se borra la prenda, se borra su historial. Si se borra el usuario, el historial queda.
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('tipo', 10);                       // entrada o salida
            $table->unsignedInteger('cantidad');              // cuántas unidades se movieron
            $table->unsignedInteger('stock_resultante');      // cómo quedó el stock después del movimiento
            $table->string('motivo', 100)->nullable();        // opcional: "Stock inicial", etc.

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos');
    }
};
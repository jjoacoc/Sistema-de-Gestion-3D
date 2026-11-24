<?php

namespace App\Http\Requests;

use App\Models\Producto;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GuardarProductoRequest extends FormRequest
{
    // ¿Quién puede crear productos? Sin login por ahora: cualquiera
    public function authorize(): bool
    {
        return true;
    }

    // Se ejecuta ANTES de validar: si escribieron un código, lo dejamos limpio y en mayúsculas
    protected function prepareForValidation(): void
    {
        if ($this->filled('codigo')) {
            $this->merge(['codigo' => strtoupper(trim($this->input('codigo')))]);
        }
    }

    // Las reglas que debe cumplir cada campo.
    // El mismo request sirve para crear (POST) y para editar (PATCH).
    public function rules(): array
    {
        // Si la ruta trae un {producto}, estamos editando
        $producto = $this->route('producto');

        $reglas = [
            'nombre' => ['required', 'string', 'max:100'],
            'categoria' => ['required', Rule::in(Producto::CATEGORIAS)],
            'talle' => ['required', 'string', 'max:10'],
            'color' => ['required', 'string', 'max:30'],
            'precio' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'cantidad' => ['required', 'integer', 'min:0', 'max:100000'],

            // Al editar se ignora el código del propio producto, para que no choque consigo mismo
            'codigo' => ['nullable', 'string', 'max:30', Rule::unique('productos', 'codigo')->ignore($producto?->id)],

            'imagen' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ];

        // Al editar no se toca la cantidad: el stock se maneja solo con entradas y salidas
        if ($producto) {
            unset($reglas['cantidad']);
        }

        return $reglas;
    }

    // Mensajes de error en español (por regla)
    public function messages(): array
    {
        return [
            'required' => 'El campo :attribute es obligatorio.',
            'string' => 'El campo :attribute debe ser un texto.',
            'numeric' => 'El campo :attribute debe ser un número.',
            'integer' => 'El campo :attribute debe ser un número entero.',
            'min' => 'El campo :attribute no puede ser menor a :min.',
            'max' => 'El campo :attribute no puede superar :max.',
            'in' => 'Elige una opción válida en :attribute.',
            'unique' => 'Ya existe un producto con ese :attribute.',
            'image' => 'El archivo de :attribute debe ser una imagen.',
            'mimes' => 'La imagen debe ser PNG, JPG o WEBP.',
            'uploaded' => 'No se pudo subir la imagen. Prueba con un archivo más liviano.',
            'imagen.max' => 'La imagen no puede pesar más de 2 MB.',
        ];
    }

    // Cómo se llama cada campo dentro de los mensajes
    public function attributes(): array
    {
        return [
            'categoria' => 'categoría',
            'codigo' => 'código',
        ];
    }
}
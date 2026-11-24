<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProveedorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // El control de rol ya lo hace el middleware de la ruta
    }

    public function rules(): array
    {
        // Al editar se ignora el propio proveedor para que el nombre no choque consigo mismo
        $proveedor = $this->route('proveedor');

        return [
            'nombre'   => ['required', 'string', 'max:100', Rule::unique('proveedores', 'nombre')->ignore($proveedor?->id)],
            'email'    => ['nullable', 'email', 'max:100'],
            'telefono' => ['nullable', 'string', 'max:30'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre es obligatorio.',
            'nombre.max'      => 'El nombre no puede superar los 100 caracteres.',
            'nombre.unique'   => 'Ya existe un proveedor con ese nombre.',
            'email.email'     => 'El email no tiene un formato válido.',
            'telefono.max'    => 'El teléfono no puede superar los 30 caracteres.',
        ];
    }
}
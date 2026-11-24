@extends('layouts.principal')

@section('titulo', 'Editar proveedor')

@section('contenido')
    <div class="max-w-md mx-auto bg-white rounded-xl shadow p-6">
        <h1 class="text-xl font-bold mb-4">Editar proveedor</h1>

        <form method="POST" action="{{ route('proveedores.actualizar', $proveedor) }}" class="space-y-3">
            @csrf
            @method('PUT')

            <div>
                <label class="block text-sm font-medium mb-1">Nombre</label>
                <input type="text" name="nombre" value="{{ old('nombre', $proveedor->nombre) }}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('nombre') <p class="text-xs text-red-600 mt-1">{{ $message }}</p> @enderror
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Email</label>
                <input type="text" name="email" value="{{ old('email', $proveedor->email) }}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('email') <p class="text-xs text-red-600 mt-1">{{ $message }}</p> @enderror
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Teléfono</label>
                <input type="text" name="telefono" value="{{ old('telefono', $proveedor->telefono) }}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                @error('telefono') <p class="text-xs text-red-600 mt-1">{{ $message }}</p> @enderror
            </div>

            <div class="flex justify-end gap-2 pt-2">
                <a href="{{ route('proveedores.listar') }}" class="px-4 py-2 text-gray-600 hover:text-gray-900">Cancelar</a>
                <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Guardar cambios</button>
            </div>
        </form>
    </div>
@endsection
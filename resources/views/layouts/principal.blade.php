<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    {{-- Token de seguridad; lo usaremos al guardar datos desde JavaScript --}}
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>@yield('titulo', 'Inicio') - {{ config('app.name') }}</title>

    {{-- Carga el CSS y JS compilados por Vite --}}
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>

<body class="bg-gray-100 text-gray-800 min-h-screen">

    {{-- Barra de navegación superior --}}
    <nav class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <span class="font-bold text-lg">{{ config('app.name') }}</span>

            @auth
                <div class="flex items-center gap-6">
                    {{-- request()->routeIs(...) detecta la página actual para resaltar la pestaña --}}
                    <a href="{{ route('panel') }}"
                        class="{{ request()->routeIs('panel') ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-blue-600' }}">
                        Panel general
                    </a>
                    <a href="{{ route('almacen') }}"
                        class="{{ request()->routeIs('almacen') ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-blue-600' }}">
                        Almacén
                    </a>
                    <a href="{{ route('movimientos.listar') }}"
                        class="{{ request()->routeIs('movimientos.*') ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-blue-600' }}">
                        Movimientos
                    </a>
                    @can('administrar')
                        <a href="{{ route('proveedores.listar') }}"
                            class="{{ request()->routeIs('proveedores.*') ? 'text-blue-600 font-semibold' : 'text-gray-600 hover:text-blue-600' }}">
                            Proveedores
                        </a>
                    @endcan

                    {{-- Usuario actual y botón de salir --}}
                    <div class="flex items-center gap-3 pl-6 border-l border-gray-200 text-sm">
                        <span class="text-gray-600">
                            {{ auth()->user()->name }}
                            <span
                                class="ml-1 px-2 py-0.5 rounded-full text-xs {{ auth()->user()->esAdministrador() ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800' }}">
                                {{ auth()->user()->rol }}
                            </span>
                        </span>
                        <form method="POST" action="{{ route('logout') }}">
                            @csrf
                            <button type="submit" class="text-gray-500 hover:text-red-600">Salir</button>
                        </form>
                    </div>
                </div>
            @endauth
        </div>
    </nav>

    {{-- Aquí cada página inserta su contenido --}}
    <main class="max-w-7xl mx-auto px-4 py-6">
        @yield('contenido')
    </main>

    {{-- Aquí cada página puede insertar sus propios scripts (por ejemplo, Konva) --}}
    @stack('scripts')
</body>

</html>
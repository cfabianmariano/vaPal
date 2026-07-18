// ========== ALMACÉN OFFLINE (IndexedDB) ==========
// Guarda datos de la ruta y cola de acciones pendientes

const DB_NAME = 'vapal-offline'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('ruta')) {
        db.createObjectStore('ruta', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('cola')) {
        db.createObjectStore('cola', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('remitos_local')) {
        db.createObjectStore('remitos_local', { keyPath: 'lineaId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// --- Ruta: guardar/leer los datos de la ruta del chofer ---

export async function guardarRutaLocal(lineas: any[]) {
  const db = await openDB()
  const tx = db.transaction('ruta', 'readwrite')
  const store = tx.objectStore('ruta')
  // Limpiar datos anteriores
  store.clear()
  for (const linea of lineas) {
    store.put(linea)
  }
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function leerRutaLocal(): Promise<any[]> {
  const db = await openDB()
  const tx = db.transaction('ruta', 'readonly')
  const store = tx.objectStore('ruta')
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// --- Remitos locales: estado del trabajo en curso ---

export async function guardarRemitoLocal(lineaId: string, data: any) {
  const db = await openDB()
  const tx = db.transaction('remitos_local', 'readwrite')
  tx.objectStore('remitos_local').put({ lineaId, ...data })
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function leerRemitoLocal(lineaId: string): Promise<any | null> {
  const db = await openDB()
  const tx = db.transaction('remitos_local', 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore('remitos_local').get(lineaId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function borrarRemitoLocal(lineaId: string) {
  const db = await openDB()
  const tx = db.transaction('remitos_local', 'readwrite')
  tx.objectStore('remitos_local').delete(lineaId)
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// --- Cola de acciones: lo que hay que sincronizar ---

export interface AccionPendiente {
  id?: number
  tipo: 'crear_remito' | 'guardar_retiro' | 'firmar' | 'no_conformado' | 'cerrar_visita'
  lineaId: string
  datos: any
  creadoAt: string
}

export async function encolarAccion(accion: Omit<AccionPendiente, 'id'>) {
  const db = await openDB()
  const tx = db.transaction('cola', 'readwrite')
  tx.objectStore('cola').add(accion)
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function leerCola(): Promise<AccionPendiente[]> {
  const db = await openDB()
  const tx = db.transaction('cola', 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore('cola').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function borrarAccion(id: number) {
  const db = await openDB()
  const tx = db.transaction('cola', 'readwrite')
  tx.objectStore('cola').delete(id)
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function contarPendientes(): Promise<number> {
  const db = await openDB()
  const tx = db.transaction('cola', 'readonly')
  return new Promise((resolve, reject) => {
    const req = tx.objectStore('cola').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

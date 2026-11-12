import { useState, useEffect, useCallback } from 'react';
import { SavedQRItem } from '../types/qr';

const STORAGE_KEY = 'qrforge:v1';

export interface StorageError {
  type: 'quota' | 'parse' | 'general';
  message: string;
}

export function useLocalStorage() {
  const [items, setItems] = useState<SavedQRItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch (e) {
      console.error('Failed to parse saved QR codes from localStorage:', e);
      return [];
    }
  });

  const [storageError, setStorageError] = useState<StorageError | null>(null);

  // Sync state to localStorage safely
  const persistItems = useCallback((newItems: SavedQRItem[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
      setItems(newItems);
      setStorageError(null);
      return true;
    } catch (err: any) {
      console.error('LocalStorage write error:', err);
      const isQuota =
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22 ||
        err.code === 1014;

      if (isQuota) {
        // Recovery attempt: strip large thumbnails from older non-favorite items
        try {
          const stripped = newItems.map((item, idx) => {
            if (idx > 5 && !item.isFavorite && item.thumbnail) {
              return { ...item, thumbnail: undefined };
            }
            return item;
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
          setItems(stripped);
          setStorageError({
            type: 'quota',
            message: 'Storage quota warning: Older thumbnails trimmed to preserve library items.',
          });
          return true;
        } catch {
          setStorageError({
            type: 'quota',
            message: 'Device storage is full! Please export and clear old items.',
          });
          return false;
        }
      }

      setStorageError({
        type: 'general',
        message: 'Could not save QR code to local storage.',
      });
      return false;
    }
  }, []);

  // Listen for storage events across tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        } catch (err) {
          console.warn('Cross-tab storage sync parse failed:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Add Item
  const addItem = useCallback(
    (item: Omit<SavedQRItem, 'id' | 'createdAt' | 'updatedAt'>): SavedQRItem | null => {
      const now = Date.now();
      const newItem: SavedQRItem = {
        ...item,
        id: `qr_${now}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const updated = [newItem, ...items];
      const success = persistItems(updated);
      return success ? newItem : null;
    },
    [items, persistItems]
  );

  // Update Item
  const updateItem = useCallback(
    (id: string, updates: Partial<SavedQRItem>): boolean => {
      const updated = items.map((it) =>
        it.id === id ? { ...it, ...updates, updatedAt: Date.now() } : it
      );
      return persistItems(updated);
    },
    [items, persistItems]
  );

  // Delete Item
  const deleteItem = useCallback(
    (id: string): boolean => {
      const updated = items.filter((it) => it.id !== id);
      return persistItems(updated);
    },
    [items, persistItems]
  );

  // Duplicate Item
  const duplicateItem = useCallback(
    (id: string): SavedQRItem | null => {
      const target = items.find((it) => it.id === id);
      if (!target) return null;

      const now = Date.now();
      const clone: SavedQRItem = {
        ...target,
        id: `qr_${now}_${Math.random().toString(36).slice(2, 7)}`,
        name: `${target.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
      };

      const updated = [clone, ...items];
      const success = persistItems(updated);
      return success ? clone : null;
    },
    [items, persistItems]
  );

  // Toggle Favorite
  const toggleFavorite = useCallback(
    (id: string): boolean => {
      const updated = items.map((it) =>
        it.id === id ? { ...it, isFavorite: !it.isFavorite } : it
      );
      return persistItems(updated);
    },
    [items, persistItems]
  );

  // Clear All
  const clearLibrary = useCallback((): boolean => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setItems([]);
      setStorageError(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Export as JSON string
  const exportLibraryJSON = useCallback((): string => {
    return JSON.stringify(
      {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        items,
      },
      null,
      2
    );
  }, [items]);

  // Import from JSON string with validation
  const importLibraryJSON = useCallback(
    (jsonString: string): { success: boolean; importedCount: number; message: string } => {
      try {
        const parsed = JSON.parse(jsonString);
        let incomingItems: any[] = [];

        if (Array.isArray(parsed)) {
          incomingItems = parsed;
        } else if (parsed && Array.isArray(parsed.items)) {
          incomingItems = parsed.items;
        } else {
          return {
            success: false,
            importedCount: 0,
            message: 'Invalid file structure: no QR items found.',
          };
        }

        // Validate items shape
        const validItems: SavedQRItem[] = [];
        const existingIds = new Set(items.map((i) => i.id));

        for (const item of incomingItems) {
          if (item && item.type && item.encodedData) {
            const id =
              item.id && !existingIds.has(item.id)
                ? item.id
                : `qr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            existingIds.add(id);

            validItems.push({
              id,
              name: String(item.name || 'Imported QR'),
              type: item.type,
              encodedData: String(item.encodedData),
              formValues: item.formValues || {},
              style: item.style || {
                fgColor: '#000000',
                bgColor: '#ffffff',
                size: 512,
                errorCorrectionLevel: 'M',
                margin: 2,
              },
              createdAt: Number(item.createdAt) || Date.now(),
              updatedAt: Number(item.updatedAt) || Date.now(),
              isFavorite: Boolean(item.isFavorite),
              thumbnail: item.thumbnail,
            });
          }
        }

        if (validItems.length === 0) {
          return {
            success: false,
            importedCount: 0,
            message: 'No valid QR codes found in imported file.',
          };
        }

        const merged = [...validItems, ...items];
        const success = persistItems(merged);

        if (success) {
          return {
            success: true,
            importedCount: validItems.length,
            message: `Successfully imported ${validItems.length} QR codes!`,
          };
        } else {
          return {
            success: false,
            importedCount: 0,
            message: 'Storage full. Failed to persist imported items.',
          };
        }
      } catch (err: any) {
        return {
          success: false,
          importedCount: 0,
          message: `Import failed: ${err.message || 'Invalid JSON file'}`,
        };
      }
    },
    [items, persistItems]
  );

  // Storage usage calculation in KB
  const getStorageSizeKB = useCallback((): number => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || '';
      return Math.round((stored.length * 2) / 1024); // UTF-16 bytes approx
    } catch {
      return 0;
    }
  }, []);

  return {
    items,
    storageError,
    addItem,
    updateItem,
    deleteItem,
    duplicateItem,
    toggleFavorite,
    clearLibrary,
    exportLibraryJSON,
    importLibraryJSON,
    getStorageSizeKB,
  };
}

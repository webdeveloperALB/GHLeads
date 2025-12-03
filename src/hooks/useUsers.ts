import { useState, useEffect } from 'react';
import { supabase, type UserProfile } from '../lib/supabase';

let usersCache: UserProfile[] | null = null;
let loadingPromise: Promise<UserProfile[]> | null = null;

export const useUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>(usersCache || []);
  const [isLoading, setIsLoading] = useState(!usersCache);

  useEffect(() => {
    if (usersCache) {
      return;
    }

    if (loadingPromise) {
      loadingPromise.then(data => {
        setUsers(data);
        setIsLoading(false);
      });
      return;
    }

    const loadUsers = async () => {
      try {
        const batchSize = 1000;

        console.log('🔄 [useUsers] Loading first 1000 users...');
        const { data: firstBatch, error: firstError } = await supabase
          .from('user_profiles')
          .select('id, full_name, role, manager_id')
          .order('full_name')
          .range(0, batchSize - 1);

        if (firstError) throw firstError;

        if (firstBatch) {
          console.log(`✅ [useUsers] Loaded ${firstBatch.length} users initially`);
          usersCache = firstBatch;
          setUsers(firstBatch);
          setIsLoading(false);

          const loadRemaining = async () => {
            let offset = batchSize;
            let hasMore = true;

            while (hasMore) {
              const { data, error } = await supabase
                .from('user_profiles')
                .select('id, full_name, role, manager_id')
                .order('full_name')
                .range(offset, offset + batchSize - 1);

              if (error) {
                console.error('❌ [useUsers] Error loading next batch:', error);
                break;
              }

              if (data && data.length > 0) {
                console.log(`📦 [useUsers] Loaded ${data.length} more users`);
                offset += batchSize;

                const seen = new Set(usersCache!.map(u => u.id));
                const newOnes = data.filter(u => !seen.has(u.id));
                if (newOnes.length > 0) {
                  usersCache = [...usersCache!, ...newOnes];
                }

                if (data.length < batchSize) hasMore = false;
              } else {
                hasMore = false;
              }
            }
            console.log(`✅ [useUsers] Finished loading all ${usersCache!.length} users`);
          };

          loadRemaining();
        }

        return firstBatch || [];
      } catch (error) {
        console.error('❌ [useUsers] Error fetching users:', error);
        setIsLoading(false);
        return [];
      }
    };

    loadingPromise = loadUsers();
    loadingPromise.then(data => {
      loadingPromise = null;
    });
  }, []);

  return { users, isLoading };
};

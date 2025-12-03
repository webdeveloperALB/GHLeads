import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser, getSubordinateIds, type Lead } from '../lib/supabase';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initializeUser = async () => {
      const user = await getCurrentUser();
      setCurrentUser(user);
    };
    initializeUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchLeads = async () => {
      if (!query.trim() || !currentUser) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const searchQuery = query.trim();

        // Build the search pattern
        let searchPattern = `email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`;

        // If the search query is a number, also search by ID
        const numericQuery = Number(searchQuery);
        if (!isNaN(numericQuery) && numericQuery > 0) {
          searchPattern += `,id.eq.${numericQuery}`;
        }

        let query_builder = supabase
          .from('leads')
          .select('*')
          .or(searchPattern);

        // Apply hierarchy filtering at database level
        if (currentUser.role !== 'admin') {
          // Fetch subordinate IDs if user is desk or manager
          let subordinateIds: string[] = [];
          if (['desk', 'manager'].includes(currentUser.role)) {
            subordinateIds = await getSubordinateIds();
          }

          if (currentUser.role === 'desk') {
            // Desk sees: leads from their desk OR assigned to them OR assigned to subordinates
            const conditions = [`desk.eq.${currentUser.full_name}`, `assigned_to.eq.${currentUser.id}`];
            if (subordinateIds.length > 0) {
              conditions.push(`assigned_to.in.(${subordinateIds.join(',')})`);
            }
            query_builder = query_builder.or(conditions.join(','));
          } else if (currentUser.role === 'manager') {
            // Manager sees: leads assigned to them OR assigned to subordinates
            const conditions = [`assigned_to.eq.${currentUser.id}`];
            if (subordinateIds.length > 0) {
              conditions.push(`assigned_to.in.(${subordinateIds.join(',')})`);
            }
            query_builder = query_builder.or(conditions.join(','));
          } else if (currentUser.role === 'agent') {
            // Agent sees: only leads assigned to them
            query_builder = query_builder.eq('assigned_to', currentUser.id);
          }
        }

        // Apply limit AFTER filtering
        query_builder = query_builder.limit(50);

        const { data, error } = await query_builder;

        if (error) throw error;

        setResults(data || []);
      } catch (error) {
        console.error('Error searching leads:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchLeads, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, currentUser]);

  const handleSelect = (lead: Lead) => {
    navigate(`/lead/${lead.id}`);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="flex items-center bg-gray-700 rounded-lg px-3 py-2">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, phone, or ID..."
          className="bg-transparent border-none focus:ring-0 text-white placeholder-gray-400 ml-2 w-64"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (query || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50">
          {loading ? (
            <div className="p-4 text-gray-400 text-center">Searching...</div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-auto">
              {results.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => handleSelect(lead)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-700 border-b border-gray-700 last:border-b-0"
                >
                  <div className="flex flex-col space-y-1">
                    <span className="font-medium text-white">
                      {lead.first_name} {lead.last_name}
                    </span>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                      <span>#{lead.id}</span>
                      <span>•</span>
                      <span>{lead.email}</span>
                      {lead.phone && (
                        <>
                          <span>•</span>
                          <span>{lead.phone}</span>
                        </>
                      )}
                    </div>
                    {lead.country && (
                      <span className="text-xs text-gray-500">{lead.country}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-4 text-gray-400 text-center">No results found</div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

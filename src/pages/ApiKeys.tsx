import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Check, X, AlertCircle, ExternalLink, Bell, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { DateTime } from 'luxon';

interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
  source_prefix: string;
  allowed_ips: string[];
  enable_notifications: boolean;
}

const ApiKeys = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState({
    name: '',
    source_prefix: '',
    allowed_ips: ''
  });
  const [copied, setCopied] = useState<string | null>(null);

  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to fetch API keys');
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKey.name.trim() || !newKey.source_prefix.trim()) {
      toast.error('Name and source prefix are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('api_keys')
        .insert({
          name: newKey.name.trim(),
          source_prefix: newKey.source_prefix.trim(),
          allowed_ips: newKey.allowed_ips.split(',').map(ip => ip.trim()).filter(Boolean),
          api_key: Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')
        });

      if (error) throw error;

      toast.success('API key created successfully');
      setIsCreating(false);
      setNewKey({ name: '', source_prefix: '', allowed_ips: '' });
      fetchApiKeys();
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    }
  };

  const handleToggleKey = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(`API key ${isActive ? 'disabled' : 'enabled'}`);
      fetchApiKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Failed to update API key');
    }
  };

  const handleToggleNotifications = async (id: string, enableNotifications: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ enable_notifications: !enableNotifications })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Notifications ${enableNotifications ? 'disabled' : 'enabled'}`);
      fetchApiKeys();
    } catch (error) {
      console.error('Error toggling notifications:', error);
      toast.error('Failed to update notifications setting');
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('API key deleted');
      setSelectedKey(null);
      fetchApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getExampleCode = (apiKey: string) => {
    return `// Submit a new lead
async function submitLead() {
  try {
    const response = await fetch("${import.meta.env.VITE_SUPABASE_URL}/leads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "${apiKey}"
      },
      body: JSON.stringify({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        country: "United States",
        brand: "Example Brand",
        source: "Website",
        funnel: "Main",
        desk: "Sales",
        sourceId: "12345"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    const data = await response.json();
    console.log("✅ Lead created:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  }
}

// Retrieve your leads (with pagination)
async function getLeads(page = 1, limit = 50) {
  try {
    const response = await fetch(
      \`${import.meta.env.VITE_SUPABASE_URL}/leads?page=\${page}&limit=\${limit}\`,
      {
        method: "GET",
        headers: {
          "X-API-Key": "${apiKey}"
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    const data = await response.json();
    console.log("✅ Leads retrieved:", data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  }
}`;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500"
        >
          <Plus size={16} />
          <span>Create API Key</span>
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Affiliate Name</label>
              <input
                type="text"
                value={newKey.name}
                onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-3 py-2"
                placeholder="Enter affiliate name"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Source Prefix</label>
              <input
                type="text"
                value={newKey.source_prefix}
                onChange={(e) => setNewKey({ ...newKey, source_prefix: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-3 py-2"
                placeholder="e.g., AFF1"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                This prefix will be used to identify leads from this affiliate
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Allowed IP Addresses</label>
              <input
                type="text"
                value={newKey.allowed_ips}
                onChange={(e) => setNewKey({ ...newKey, allowed_ips: e.target.value })}
                className="w-full bg-gray-700 rounded-lg px-3 py-2"
                placeholder="Enter comma-separated IP addresses"
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional. Leave empty to allow all IPs
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500"
              >
                Create API Key
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {apiKeys.map((key) => (
          <div key={key.id} className="bg-gray-800 rounded-lg">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750"
              onClick={() => setSelectedKey(selectedKey === key.id ? null : key.id)}
            >
              <div>
                <h3 className="font-medium">{key.name}</h3>
                <p className="text-sm text-gray-400">Source: {key.source_prefix}</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded text-sm ${
                  key.is_active
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-red-600/20 text-red-400'
                }`}>
                  {key.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleNotifications(key.id, key.enable_notifications);
                  }}
                  className={`p-1 rounded ${
                    key.enable_notifications
                      ? 'text-blue-400 hover:text-blue-300'
                      : 'text-gray-500 hover:text-gray-400'
                  }`}
                  title={key.enable_notifications ? 'Notifications enabled' : 'Notifications disabled'}
                >
                  {key.enable_notifications ? <Bell size={16} /> : <BellOff size={16} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleKey(key.id, key.is_active);
                  }}
                  className="text-gray-400 hover:text-white"
                  title={key.is_active ? 'Disable API key' : 'Enable API key'}
                >
                  {key.is_active ? <X size={16} /> : <Check size={16} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteKey(key.id);
                  }}
                  className="text-red-500 hover:text-red-400"
                  title="Delete API key"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {selectedKey === key.id && (
              <div className="p-4 border-t border-gray-700">
                <div className="bg-gray-900 rounded p-4 mb-4 font-mono text-sm flex items-center justify-between">
                  <span>{key.api_key}</span>
                  <button
                    onClick={() => copyToClipboard(key.api_key, `key-${key.id}`)}
                    className="text-gray-400 hover:text-white"
                  >
                    {copied === `key-${key.id}` ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-400">Created:</span>{' '}
                    {DateTime.fromISO(key.created_at).toFormat('yyyy-MM-dd HH:mm:ss')}
                  </div>
                  <div>
                    <span className="text-gray-400">Last Used:</span>{' '}
                    {key.last_used
                      ? DateTime.fromISO(key.last_used).toFormat('yyyy-MM-dd HH:mm:ss')
                      : 'Never'}
                  </div>
                  <div>
                    <span className="text-gray-400">Allowed IPs:</span>{' '}
                    {key.allowed_ips?.length > 0 ? key.allowed_ips.join(', ') : 'Any'}
                  </div>
                  <div>
                    <span className="text-gray-400">Notifications:</span>{' '}
                    <span className={key.enable_notifications ? 'text-green-400' : 'text-gray-500'}>
                      {key.enable_notifications ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium flex items-center mb-4">
                    <AlertCircle size={16} className="text-blue-400 mr-2" />
                    API Documentation
                  </h4>

                  <div className="space-y-6">
                    <div>
                      <h5 className="font-medium mb-2">Endpoint</h5>
                      <div className="bg-gray-900 rounded p-3 font-mono text-sm">
                        <div className="flex items-center justify-between">
                          <code>POST {import.meta.env.VITE_SUPABASE_URL}/leads</code>
                          <button
                            onClick={() => copyToClipboard(`${import.meta.env.VITE_SUPABASE_URL}/leads`, `url-${key.id}`)}
                            className="text-gray-400 hover:text-white"
                          >
                            {copied === `url-${key.id}` ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Headers</h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="py-2">Header</th>
                            <th className="py-2">Value</th>
                            <th className="py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          <tr>
                            <td className="py-2">Content-Type</td>
                            <td><code>application/json</code></td>
                            <td>Request body format</td>
                          </tr>
                          <tr>
                            <td className="py-2">X-API-Key</td>
                            <td><code>{key.api_key}</code></td>
                            <td>Your API key for authentication</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Request Body</h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="py-2">Field</th>
                            <th className="py-2">Type</th>
                            <th className="py-2">Required</th>
                            <th className="py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          <tr>
                            <td className="py-2">firstName</td>
                            <td>string</td>
                            <td>Yes</td>
                            <td>First name of the lead</td>
                          </tr>
                          <tr>
                            <td className="py-2">lastName</td>
                            <td>string</td>
                            <td>Yes</td>
                            <td>Last name of the lead</td>
                          </tr>
                          <tr>
                            <td className="py-2">email</td>
                            <td>string</td>
                            <td>Yes</td>
                            <td>Valid email address (must be unique)</td>
                          </tr>
                          <tr>
                            <td className="py-2">phone</td>
                            <td>string</td>
                            <td>No</td>
                            <td>Phone number with country code</td>
                          </tr>
                          <tr>
                            <td className="py-2">country</td>
                            <td>string</td>
                            <td>No</td>
                            <td>Country name</td>
                          </tr>
                          <tr>
                            <td className="py-2">brand</td>
                            <td>string</td>
                            <td>No</td>
                            <td>Brand name</td>
                          </tr>
                          <tr>
                            <td className="py-2">source</td>
                            <td>string</td>
                            <td>No</td>
                            <td>Lead source identifier</td>
                          </tr>
                          <tr>
                            <td className="py-2">funnel</td>
                            <td>string</td>
                            <td>No</td>
                            <td>Marketing funnel name</td>
                          </tr>
                          <tr>
                            <td className="py-2">desk</td>
                            <td>string</td>
                            <td>No</td>
                            <td>Sales desk identifier</td>
                          </tr>
                          <tr>
                            <td className="py-2">sourceId</td>
                            <td>string</td>
                            <td>No</td>
                            <td>External source identifier</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Response Codes</h5>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="py-2">Code</th>
                            <th className="py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          <tr>
                            <td className="py-2">200</td>
                            <td>Lead created successfully</td>
                          </tr>
                          <tr>
                            <td className="py-2">400</td>
                            <td>Invalid request body or validation error</td>
                          </tr>
                          <tr>
                            <td className="py-2">401</td>
                            <td>Invalid or missing API key</td>
                          </tr>
                          <tr>
                            <td className="py-2">403</td>
                            <td>IP address not allowed or API key inactive</td>
                          </tr>
                          <tr>
                            <td className="py-2">409</td>
                            <td>Lead with this email already exists</td>
                          </tr>
                          <tr>
                            <td className="py-2">429</td>
                            <td>Rate limit exceeded (max 100 requests per minute)</td>
                          </tr>
                          <tr>
                            <td className="py-2">500</td>
                            <td>Internal server error</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Example Code</h5>
                      <div className="relative">
                        <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
                          <code>{getExampleCode(key.api_key)}</code>
                        </pre>
                        <button
                          onClick={() => copyToClipboard(getExampleCode(key.api_key), `code-${key.id}`)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        >
                          {copied === `code-${key.id}` ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Success Response</h5>
                
                      <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
                        <code>{JSON.stringify({
                          success: true,
                          data: {
                            id: "12345",
                            source_id: "ABC123",
                            created_at: "2025-03-24T13:45:00Z"
                          }
                        }, null, 2)}</code>
                      </pre>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Error Response</h5>
                      <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
                        <code>{JSON.stringify({
                          success: false,
                          error: {
                            code: "validation_error",
                            message: "Invalid email format",
                            details: {
                              field: "email",
                              value: "invalid-email"
                            }
                          }
                        }, null, 2)}</code>
                      </pre>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <a
                        href="/api/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center"
                      >
                        <span>View Full API Documentation</span>
                        <ExternalLink size={14} className="ml-1" />
                      </a>
                      <a
                        href="/api/postman"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center"
                      >
                        <span>Download Postman Collection</span>
                        <ExternalLink size={14} className="ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApiKeys;
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Generate sync batch ID
function generateSyncBatchId() {
  return 'SYNC-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex');
}

// Get sync status for a tenant
router.get('/status/:tenant_id', async (req, res) => {
    try {
        const { tenant_id } = req.params;
        const { last_sync_id } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Get last sync status
        const { data: lastSync, error: syncError } = await supabase
            .from('sync_batches')
            .select('*')
            .eq('tenant_id', tenant_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Get pending offline operations
        const { data: pendingOps, error: opsError } = await supabase
            .from('offline_operations')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('synced', false)
            .order('created_at', { ascending: true });

        // Get sync conflicts
        const { data: conflicts, error: conflictsError } = await supabase
            .from('sync_conflicts')
            .select('*')
            .eq('tenant_id', tenant_id)
            .eq('resolved', false)
            .order('created_at', { ascending: false });

        res.status(200).json({
            success: true,
            sync_status: {
                last_sync: lastSync || null,
                pending_operations: pendingOps?.length || 0,
                conflicts: conflicts?.length || 0,
                is_syncing: lastSync ? lastSync.status === 'processing' : false
            },
            pending_operations: pendingOps || [],
            conflicts: conflicts || []
        });
    } catch (error) {
        console.error("Get sync status error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initiate sync process
router.post('/initiate', async (req, res) => {
    try {
        const { tenant_id, device_id, operations } = req.body;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Create sync batch
        const batchId = generateSyncBatchId();
        const { data: syncBatch, error: batchError } = await supabase
            .from('sync_batches')
            .insert({
                tenant_id,
                device_id,
                batch_id: batchId,
                status: 'processing',
                operation_count: operations?.length || 0
            })
            .select()
            .single();

        if (batchError) {
            throw batchError;
        }

        // Process operations if provided
        if (operations && operations.length > 0) {
            const processedResults = [];
            const conflicts = [];

            for (const operation of operations) {
                try {
                    const result = await processOperation(tenant_id, operation);
                    processedResults.push({
                        operation_id: operation.id,
                        success: true,
                        result
                    });
                } catch (error) {
                    // Check if it's a conflict
                    if (error.message.includes('conflict') || error.message.includes('duplicate')) {
                        conflicts.push({
                            operation_id: operation.id,
                            operation: operation,
                            error: error.message
                        });
                    } else {
                        processedResults.push({
                            operation_id: operation.id,
                            success: false,
                            error: error.message
                        });
                    }
                }
            }

            // Update sync batch status
            const finalStatus = conflicts.length > 0 ? 'partial' : 'completed';
            await supabase
                .from('sync_batches')
                .update({
                    status: finalStatus,
                    completed_at: new Date().toISOString(),
                    success_count: processedResults.filter(r => r.success).length,
                    failure_count: processedResults.filter(r => !r.success).length
                })
                .eq('id', syncBatch.id);

            // Log conflicts
            for (const conflict of conflicts) {
                await supabase
                    .from('sync_conflicts')
                    .insert({
                        tenant_id,
                        sync_batch_id: syncBatch.id,
                        operation_id: conflict.operation_id,
                        operation_data: conflict.operation,
                        conflict_type: 'data_conflict',
                        error_message: conflict.error,
                        resolved: false
                    });
            }

            res.status(200).json({
                success: true,
                batch_id: batchId,
                status: finalStatus,
                processed_operations: processedResults,
                conflicts_count: conflicts.length
            });
        } else {
            // Just create batch without operations (for pull sync)
            res.status(200).json({
                success: true,
                batch_id: batchId,
                status: 'processing',
                message: 'Sync batch created, ready for data pull'
            });
        }
    } catch (error) {
        console.error("Initiate sync error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Process individual offline operation
async function processOperation(tenantId, operation) {
    const { operation_type, table, data, original_id } = operation;

    switch (operation_type) {
        case 'insert':
            return await processInsert(tenantId, table, data);
        case 'update':
            return await processUpdate(tenantId, table, data, original_id);
        case 'delete':
            return await processDelete(tenantId, table, original_id);
        default:
            throw new Error(`Unknown operation type: ${operation_type}`);
    }
}

async function processInsert(tenantId, table, data) {
    const { data: result, error } = await supabase
        .from(table)
        .insert({
            ...data,
            tenant_id: tenantId
        })
        .select()
        .single();

    if (error) throw error;
    return result;
}

async function processUpdate(tenantId, table, data, originalId) {
    const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', originalId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

    if (error) throw error;
    return result;
}

async function processDelete(tenantId, table, originalId) {
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', originalId)
        .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true, id: originalId };
}

// Pull data for offline use
router.post('/pull', async (req, res) => {
    try {
        const { tenant_id, tables, last_sync_timestamp } = req.body;

        if (!tenant_id || !tables) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const pulledData = {};

        for (const table of tables) {
            let query = supabase
                .from(table)
                .select('*')
                .eq('tenant_id', tenant_id);

            // Only get data modified since last sync
            if (last_sync_timestamp) {
                query = query.gte('updated_at', last_sync_timestamp);
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error pulling ${table}:`, error);
                pulledData[table] = { error: error.message };
            } else {
                pulledData[table] = data || [];
            }
        }

        res.status(200).json({
            success: true,
            data: pulledData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Pull sync error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Store offline operation
router.post('/offline/store', async (req, res) => {
    try {
        const { tenant_id, device_id, operation_type, table, data, original_id } = req.body;

        if (!tenant_id || !operation_type || !table) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { data: operation, error } = await supabase
            .from('offline_operations')
            .insert({
                tenant_id,
                device_id,
                operation_type,
                table,
                data,
                original_id,
                synced: false,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        res.status(200).json({
            success: true,
            operation_id: operation.id,
            message: 'Operation stored for offline sync'
        });
    } catch (error) {
        console.error("Store offline operation error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Resolve sync conflict
router.post('/conflict/resolve', async (req, res) => {
    try {
        const { conflict_id, resolution, resolved_by } = req.body;

        if (!conflict_id || !resolution) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Get conflict details
        const { data: conflict, error: conflictError } = await supabase
            .from('sync_conflicts')
            .select('*')
            .eq('id', conflict_id)
            .single();

        if (conflictError || !conflict) {
            return res.status(404).json({ error: 'Conflict not found' });
        }

        // Apply resolution
        let result;
        switch (resolution) {
            case 'use_server':
                // Server data wins, do nothing with offline operation
                result = { action: 'ignored', reason: 'server_data_used' };
                break;
            case 'use_client':
                // Apply offline operation
                result = await processOperation(conflict.tenant_id, conflict.operation_data);
                break;
            case 'merge':
                // Custom merge logic would go here
                result = { action: 'merged', reason: 'custom_merge' };
                break;
            default:
                return res.status(400).json({ error: 'Invalid resolution type' });
        }

        // Mark conflict as resolved
        await supabase
            .from('sync_conflicts')
            .update({
                resolved: true,
                resolution,
                resolved_by,
                resolved_at: new Date().toISOString(),
                resolution_data: result
            })
            .eq('id', conflict_id);

        // Mark operation as synced
        await supabase
            .from('offline_operations')
            .update({ synced: true })
            .eq('id', conflict.operation_id);

        res.status(200).json({
            success: true,
            result
        });
    } catch (error) {
        console.error("Resolve conflict error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get sync statistics
router.get('/stats/:tenant_id', async (req, res) => {
    try {
        const { tenant_id } = req.params;
        const { period = '7d' } = req.query;

        if (!tenant_id) {
            return res.status(400).json({ error: 'Missing tenant_id' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7); // Default to 7 days

        // Get sync batch statistics
        const { data: syncBatches, error: syncError } = await supabase
            .from('sync_batches')
            .select('*')
            .eq('tenant_id', tenant_id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        // Get offline operation statistics
        const { data: offlineOps, error: opsError } = await supabase
            .from('offline_operations')
            .select('*')
            .eq('tenant_id', tenant_id)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        const stats = {
            period: period,
            total_syncs: syncBatches?.length || 0,
            successful_syncs: syncBatches?.filter(s => s.status === 'completed').length || 0,
            failed_syncs: syncBatches?.filter(s => s.status === 'failed').length || 0,
            total_operations: offlineOps?.length || 0,
            synced_operations: offlineOps?.filter(o => o.synced).length || 0,
            pending_operations: offlineOps?.filter(o => !o.synced).length || 0,
            average_sync_time: 0 // Would need to calculate from timestamps
        };

        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        console.error("Get sync stats error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual conflict resolution for specific data
router.post('/manual-merge', async (req, res) => {
    try {
        const { tenant_id, table, record_id, merged_data, resolved_by } = req.body;

        if (!tenant_id || !table || !record_id || !merged_data) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        // Apply merged data
        const { data: result, error } = await supabase
            .from(table)
            .update({
                ...merged_data,
                updated_at: new Date().toISOString()
            })
            .eq('id', record_id)
            .eq('tenant_id', tenant_id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Log the manual merge
        await supabase
            .from('sync_conflicts')
            .insert({
                tenant_id,
                operation_id: null,
                operation_data: { table, record_id, merged_data },
                conflict_type: 'manual_merge',
                error_message: 'Manual merge performed',
                resolved: true,
                resolution: 'manual',
                resolved_by,
                resolved_at: new Date().toISOString(),
                resolution_data: result
            });

        res.status(200).json({
            success: true,
            result
        });
    } catch (error) {
        console.error("Manual merge error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
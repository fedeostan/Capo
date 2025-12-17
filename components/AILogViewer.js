import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './ui/Text';
import { theme } from '../theme';
import { Feather } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const LogItem = ({ item }) => {
    let iconName = 'info';
    let color = theme.colors.blue[400];

    switch (item.type) {
        case 'success':
            iconName = 'check-circle';
            color = theme.colors.emerald[400];
            break;
        case 'error':
            iconName = 'alert-circle';
            color = theme.colors.destructive.DEFAULT;
            break;
        case 'warning':
            iconName = 'alert-triangle';
            color = theme.colors.amber[400];
            break;
        case 'start':
            iconName = 'play-circle';
            color = theme.colors.primary.DEFAULT;
            break;
    }

    return (
        <View style={styles.logItem}>
            <View style={styles.logTimestamp}>
                <Text style={styles.monoText}>
                    {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                </Text>
            </View>
            <View style={styles.logContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Feather name={iconName} size={14} color={color} style={{ marginRight: 8 }} />
                    <Text style={[styles.logStep, { color }]}>{item.step}</Text>
                </View>
                <Text style={styles.logDetail} selectable={true}>{typeof item.detail === 'string' ? item.detail : JSON.stringify(item.detail, null, 2)}</Text>
            </View>
        </View>
    );
};

export function AILogViewer({ projectId, onClose }) {
    const [logs, setLogs] = useState([]);
    const scrollViewRef = useRef();

    const [error, setError] = useState(null);

    useEffect(() => {
        if (!projectId) return;

        console.log("Listening for logs for project:", projectId);
        setError(null);

        const q = query(
            collection(db, 'ai_logs'),
            where('projectId', '==', projectId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const newLogs = [];
                snapshot.forEach((doc) => {
                    newLogs.push({ id: doc.id, ...doc.data() });
                });
                // Reverse to show oldest first in the terminal view (bottom is newest)
                setLogs(newLogs.reverse());
            },
            (err) => {
                console.error("AI Log Query Error:", err);
                setError(err.message);
            }
        );

        return () => unsubscribe();
    }, [projectId]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="terminal" size={18} color={theme.colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.headerTitle}>AI Reasoning Engine</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Feather name="x" size={20} color={theme.colors.gray[400]} />
                </TouchableOpacity>
            </View>
            <ScrollView
                ref={scrollViewRef}
                style={styles.logsContainer}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
                {error ? (
                    <View style={{ padding: 16 }}>
                        <Text style={[styles.monoText, { color: theme.colors.destructive.DEFAULT }]}>
                            Error loading logs:
                        </Text>
                        <Text style={[styles.monoText, { color: theme.colors.destructive.DEFAULT, marginTop: 8 }]}>
                            {error}
                        </Text>
                    </View>
                ) : logs.length === 0 ? (
                    <Text style={[styles.monoText, { color: theme.colors.gray[500], fontStyle: 'italic' }]}>
                        Waiting for AI activity...
                    </Text>
                ) : (
                    logs.map(log => <LogItem key={log.id} item={log} />)
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a', // Slate 900
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b', // Slate 800
        backgroundColor: '#0f172a',
    },
    headerTitle: {
        color: theme.colors.white,
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'System', // Use mono if available or default
        letterSpacing: 0.5,
    },
    logsContainer: {
        flex: 1,
    },
    logItem: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
    },
    logTimestamp: {
        width: 70,
        marginRight: 10,
        paddingTop: 2,
    },
    logContent: {
        flex: 1,
    },
    logStep: {
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Courier',
    },
    logDetail: {
        color: '#94a3b8', // Slate 400
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Courier',
    },
    monoText: {
        fontFamily: 'Courier',
        fontSize: 11,
        color: '#64748b', // Slate 500
    }
});

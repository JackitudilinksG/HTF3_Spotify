import { Client, Databases, Query } from 'appwrite';

if (!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || !process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID) {
    throw new Error('Missing Appwrite environment variables');
}

const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

const databases = new Databases(client);

// Add connection status check
export const checkDatabaseConnection = async () => {
    try {
        if (!process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID) {
            throw new Error('Missing database ID');
        }
        
        // Try to list documents to check connection
        await databases.listDocuments(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
            '67dd0835002a44483f58',
            [Query.limit(1)]
        );
        
        return { success: true };
    } catch (error: any) {
        console.error('Database connection error:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to connect to database' 
        };
    }
};

export const verifyTeamCode = async (teamCode: string) => {
    try {
        if (!process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID) {
            throw new Error('Missing database ID');
        }

        // First check database connection
        const connectionCheck = await checkDatabaseConnection();
        if (!connectionCheck.success) {
            throw new Error('Database connection failed');
        }

        console.log('Verifying team code:', teamCode);
        console.log('Using endpoint:', process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT);
        console.log('Using project ID:', process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);
        console.log('Using database ID:', process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID);

        const response = await databases.listDocuments(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID,
            '67dd0835002a44483f58',
            [
                Query.equal('team_code', teamCode)
            ]
        );

        console.log('Appwrite response:', response);

        if (response.documents.length > 0) {
            console.log('Found team:', response.documents[0]);
            return {
                success: true,
                team: response.documents[0]
            };
        }

        console.log('No team found with code:', teamCode);
        return {
            success: false,
            error: 'Invalid team code'
        };
    } catch (error: any) {
        console.error('Detailed error verifying team code:', error);
        return {
            success: false,
            error: error.message || 'Failed to verify team code'
        };
    }
}; 
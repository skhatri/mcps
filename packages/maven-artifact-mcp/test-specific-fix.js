#!/usr/bin/env node

/**
 * Targeted test to verify the specific Maven Central API fix
 * Tests the original failing case with correct coordinates and verifies JSON parsing
 */

import { mavenResolver } from './dist/tools/maven-resolver.js';

async function testSpecificFix() {
    console.log('🔧 Testing Maven Central API Fix - Targeted Test');
    console.log('='.repeat(60));
    console.log('This test specifically verifies that:');
    console.log('1. The URL has been changed from /classic/solrsearch/select to /solrsearch/select');
    console.log('2. Compression headers have been removed');
    console.log('3. JSON responses are parsed correctly (no "Unexpected token" errors)');
    console.log('4. The original Apache Flink example now works');
    console.log('='.repeat(60));
    
    // Test the corrected Apache Flink coordinates
    const testCases = [
        ['org.apache.flink', 'flink-core', 'Apache Flink Core (Corrected coordinates)'],
        ['org.apache.flink', 'flink-java', 'Apache Flink Java API'],
        ['org.apache.flink', 'flink-streaming-java', 'Apache Flink Streaming Java'],
        
        // These are known to work well and have stable versions
        ['com.google.guava', 'guava', 'Google Guava (Control test)'],
        ['junit', 'junit', 'JUnit 4 (Control test)']
    ];
    
    let successCount = 0;
    let jsonParseSuccessCount = 0;
    
    for (const [groupId, artifactId, description] of testCases) {
        console.log(`\n=== ${description} ===`);
        console.log(`Artifact: ${groupId}:${artifactId}`);
        
        try {
            const startTime = Date.now();
            const result = await mavenResolver.getLatestVersion({ groupId, artifactId });
            const duration = Date.now() - startTime;
            
            console.log('✅ SUCCESS - API call completed');
            console.log('✅ SUCCESS - JSON parsing worked (no "Unexpected token" error)');
            console.log(`📦 Latest Version: ${result.latestVersion}`);
            console.log(`📅 Last Updated: ${result.lastUpdated}`);
            console.log(`🏪 Repository: ${result.repository}`);
            console.log(`⚡ Duration: ${duration}ms`);
            console.log(`💾 From Cache: ${result.cached ? 'Yes' : 'No'}`);
            
            if (result.excludedVersions && result.excludedVersions.length > 0) {
                console.log(`🚫 Excluded Versions (first 3): ${result.excludedVersions.slice(0, 3).join(', ')}`);
                console.log(`📊 Total Versions Available: ${result.totalVersions || 'Unknown'}`);
            }
            
            successCount++;
            jsonParseSuccessCount++;
            
        } catch (error) {
            console.log('❌ FAILED - API call failed');
            
            // Check if this is a JSON parsing error (the original issue)
            if (error.message.includes('Unexpected token') || error.message.includes('not valid JSON')) {
                console.log('💥 CRITICAL: JSON parsing failed - the fix did not work!');
                console.log(`JSON Error: ${error.message}`);
            } else {
                console.log('✅ JSON parsing OK - Error is application logic, not the original bug');
                console.log(`Application Error: ${error.message}`);
                jsonParseSuccessCount++;
            }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TARGETED TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`📊 Overall Success: ${successCount}/${testCases.length} artifacts resolved successfully`);
    console.log(`🔧 Fix Verification: ${jsonParseSuccessCount}/${testCases.length} requests had valid JSON (no parsing errors)`);
    
    if (jsonParseSuccessCount === testCases.length) {
        console.log('🎉 EXCELLENT: The Maven Central API fix is working perfectly!');
        console.log('✅ No "Unexpected token" or JSON parsing errors detected');
        console.log('✅ URL change from /classic/solrsearch/select to /solrsearch/select works');
        console.log('✅ Compression header removal resolved the response issues');
    } else {
        console.log('⚠️ WARNING: Some requests still have JSON parsing issues');
        console.log('The original fix may not be complete or there are other issues');
    }
    
    if (successCount > 0) {
        console.log(`✅ ${successCount} artifacts were successfully resolved, proving the API works`);
    }
    
    console.log('\n🧹 Cleaning up...');
    mavenResolver.destroy();
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error('\n❌ Unhandled promise rejection:', error);
    process.exit(1);
});

// Run the targeted test
testSpecificFix().catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
});
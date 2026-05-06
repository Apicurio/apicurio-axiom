package io.apicurio.axiom.engine.opencode;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link OpenCodeServerManager} — CLI availability detection
 * and version retrieval (without requiring a running server).
 */
class OpenCodeServerManagerTest {

    @Test
    void testIsOpenCodeAvailableReturnsBoolean() {
        // This will return true if opencode is installed, false otherwise.
        // Either way, it should not throw.
        boolean available = OpenCodeServerManager.isOpenCodeAvailable();
        // Just verify it returns without error — actual value depends on environment
        assertTrue(available || !available);
    }

    @Test
    void testGetCliVersionReturnsNullOrString() {
        String version = OpenCodeServerManager.getCliVersion();
        // Returns null if not installed, or a version string if installed.
        // Should not throw either way.
        if (version != null) {
            assertFalse(version.isBlank(), "Version should not be blank if returned");
        }
    }

    @Test
    void testConstructor() {
        OpenCodeServerManager manager = new OpenCodeServerManager("127.0.0.1", 4096);
        assertNotNull(manager);
        assertNull(manager.getClient(), "Client should be null before server is started");
    }

    @Test
    void testStopWithoutStartDoesNotThrow() {
        OpenCodeServerManager manager = new OpenCodeServerManager("127.0.0.1", 9999);
        // Should not throw even if server was never started
        assertDoesNotThrow(manager::stop);
    }
}

package com.example.test;

/**
 * Sample Java class for testing
 */
public class Sample {
    private String name;
    private int value;

    /**
     * Constructor for Sample
     *
     * @param name The name
     * @param value The value
     */
    public Sample(String name, int value) {
        this.name = name;
        this.value = value;
    }

    /**
     * Get the name
     *
     * @return The name
     */
    public String getName() {
        return name;
    }

    /**
     * Calculate something
     *
     * @param input Input value
     * @return Calculated result
     */
    public int calculate(int input) {
        return input * value;
    }

    /**
     * Process data
     *
     * @param data Data to process
     * @return Processed data
     */
    public String processData(String data) {
        if (data == null || data.isEmpty()) {
            throw new IllegalArgumentException("Data cannot be null or empty");
        }
        return data.toUpperCase();
    }
}

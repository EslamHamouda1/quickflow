package com.quickflow.dashboard;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Test clock: fixed instant that tests can advance. */
final class MutableClock extends Clock {

    private Instant instant;
    private final ZoneId zone;

    MutableClock(Instant instant) {
        this(instant, ZoneOffset.UTC);
    }

    MutableClock(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    void advance(Duration d) {
        instant = instant.plus(d);
    }

    void set(Instant i) {
        instant = i;
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId z) {
        return new MutableClock(instant, z);
    }

    @Override
    public Instant instant() {
        return instant;
    }
}

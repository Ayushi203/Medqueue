package com.medqueue.controller;

public class RatingRequest {

    private Integer stars;
    private String comment;

    public RatingRequest() {
    }

    public Integer getStars() {
        return stars;
    }

    public void setStars(Integer stars) {
        this.stars = stars;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}

/**
 * MODELS: Here we are defining all the models in the MVC structure
 * ----------------------------------------------------------------
 * 
 */

/**
 * lab_activity is a model which represents some activity in the lab, could be reservation, enable, etc
 */
var lab_activity = Backbone.Model.extend({
	defaults: {
		project: null,
		item: null,
                month: null,
                year: null,
                hours: null
	}
});

/**
 * cost_activity is a model which represents the billable portion of the lab activity
 */
var cost_activity = Backbone.Model.extend({
	defaults: {
		"lab_activity" : null,
		"charge": null
	}
});

/**
 * An item is something that is used in the lab, probably an instrument or tool
 */
var item = Backbone.Model.extend( {
	defaults: {
		"name": null,
		"tier": null
	}
    });

/**
 * An error
 */
var error = Backbone.Model.extend({
			defaults: { message: "" }
		});

/**
 * A tier has a name and a rate
 */
var tier = Backbone.Model.extend( {
	defaults: {
		"name": null,
		"rate": null,
                "external_rate": null
	}});


/**
 * A cap has a threshold and a rate
 */
var cap = Backbone.Model.extend( {
	defaults: {
		"threshold": null,
		"rate": null
	}});


/**
 * A project gets billed for cost_activities and performs the translation from lab_activity to cost activity
 */
var project = Backbone.Model.extend( {
	defaults: {
		"name": null,
		"type": null,
		"cap": null,
                "toolset": null,
                "collector": null
	},
	set_toolset: function(tools) {
		this.set('toolset', tools);
	},
	set_bill_collector: function(collector) {
		this.set('collector', collector);
	},
	add_lab_activity: function( lab_activity ) {
		if (lab_activity.get('project').get('name') == this.get('name')) {
			var collector = this.get('collector');
                        var cost = this.calculate_cost(lab_activity);
                        collector.add(cost);	
		} else {
			throw new Error('Adding activity to wrong project');
		}
	},
        is_external: function() {
          var type = this.get('type');
          if (type == 'off campus') {
              return true;
          }
        },
	calculate_cost: function (lab_activity) {
		var cost = new cost_activity();
		var item = lab_activity.get('item');
		var item_name = item.get('name');
		var tier = item.get('tier');
		if (tier == undefined) {
			throw item_name + " has no tier assigned to it.";
		}
		var rate = tier.get('rate');
                
                if (this.is_external()) {
                    rate = item.get('tier').get('external_rate');
                }
                
		var collector = this.get('collector');
		var cap = this.get('cap').get('threshold');
		var cap_reduction = this.get('cap').get('rate');
                
		cost.set('lab_activity', lab_activity);

		var hours = lab_activity.get('hours');
		var charge = hours * rate;
                
                var charges_so_far = collector.month_project_subtotal(
                                                    lab_activity.get('year'),
                                                    lab_activity.get('month'),
                                                    this.get('name')
                                                );

		if (charges_so_far > cap) {
			charge = rate * hours * cap_reduction;
		} else if (charges_so_far + charge > cap) {
			var full_charge_portion = (cap - charges_so_far) / rate / hours;
			var discounted_charge_portion = 1 - full_charge_portion;
			charge = full_charge_portion * rate * hours;
			charge += discounted_charge_portion * rate * hours * cap_reduction;
		}

		cost.set('charge', charge);
		return cost;
	}
});

var batch_processor = Backbone.Model.extend({
	defaults: {
		data: [],
		process_function: function() {
                },
		complete: function() {
                },
                stepsize: 200,
                batch_iterator: null,
                id: null,
                width: 300,
                height: 30,
                color: '#acc',
                progress_multiplier: 1,
                batch_pause_interval: 50,
                begin_timestamp: new Date(),
                templates: {
                    overlay: '<div id="batch_overlay_<%=id%>" style="display: block; position: absolute; top: 0%; left: 0%; width: 100%; height: 100%; background-color: black; z-index:1001; -moz-opacity: 0.8; opacity:.80; filter: alpha(opacity=80);"></div>',
                    progress: '<div id="batch_progress_outer_<%=id%>" style="position: absolute; top: <%=offsetY%>px; width: 100%; z-index: 1002">\n\
                                <div id="batch_progress_info_<%=id%>" style="padding: 10px 10px 50px 10px; text-align: center; width: <%=width%>px; height: <%=height%>px; background-color: white; z-index: 1002; margin-left: auto; margin-right: auto;">Loading <span class="progress_count"> <%=count%></span> of <%=total%>\n\
                                <div id="batch_progress_container_<%=id%>" style="width: <%=width%>px; height: <%=height%>px; border: 1px solid #ccc; background-color: white; z-index: 1002; margin-left: auto; margin-right: auto;">\n\
                                    <div class="progress_bar" id="batch_progress_<%=id%>" style="width: 0; background-color: <%=color%>; height: <%=height%>px">\n\
                                    </div>\n\
                                </div>\n\
				</div>\
                                </div>'
                }
	},
        initialize: function() {
            
        },      
	go: function () {
		    this.calculate_multiplier();
		    this.setup_ui();
		    this.run_batches();
	},
        calculate_multiplier: function() {
            this.set('progress_multiplier', 100 / this.get('data').length);
        },
        setup_ui: function() {
            this.save_html_dimensions();
            this.full_screen();
            
            var templates = this.get('templates');
            var overlay = $(_.template(templates['overlay'], {id: this.get('id')}));
            
            var progress = $(_.template(templates['progress'], {id: this.get('id'),
                                                            width: this.get('width'),
                                                            height: this.get('height'),
                                                            offsetY: window.scrollY + 20,
                                                            count: 0,
                                                            total: this.get('data').length,
                                                            color: this.get('color')}));
            $('html').append(overlay);
            $('html').append(progress);
            
            this.set('overlay', overlay);
            this.set('progress', progress);
        },
        run_batches: function() {
	    this.set('batch_iterator', 0);
            this.set('begin_timestamp', new Date());
	    this.update_ui(0);
            //setTimeout to call this function again
            var that = this;  
            window.setTimeout( function(){that.run_batch();} , this.get('batch_pause_interval'));   
        },
	run_batch: function() {
	    try {
		    var i = this.get('batch_iterator');
		    var number_of_data_to_crunch = this.get('stepsize');
		    var the_data = this.get('data'); 
		    var the_function = this.get('process_function'); 
		    if (i + number_of_data_to_crunch > the_data.length) {
			number_of_data_to_crunch = the_data.length - i;
		    }
		    the_function(the_data.slice(i, i + number_of_data_to_crunch));
		    this.update_ui(i);
		    i += this.get('stepsize');
		    this.set('batch_iterator', i);
		    if (i < the_data.length) {
			//setTimeout to call this function again
			var that = this;  
			window.setTimeout( function(){that.run_batch();} , this.get('batch_pause_interval'));   
		    } else {
			this.restore_ui();
			var complete_function = this.get('complete');
			complete_function();
		    }
	    } catch (message) {
		    this.restore_ui();
		    var error_handler = this.get('error_handler');
		    error_handler(message);
	    }
	},
        update_ui: function(i) {
            var progress_percentage = i * this.get('progress_multiplier') ;
            progress_percentage = progress_percentage.toPrecision(2);
            $(this.get('progress').find('.progress_bar')).css('width', progress_percentage + '%');
            $(this.get('progress').find('.progress_count')).html(i);
        }, 
        restore_ui: function() {
            this.restore_html_dimensions();
            var time_to_complete = (new Date() - this.get('begin_timestamp')) / 1000;
            
            $(this.get('progress').find('.progress_bar')).css('background-color', '#fff').html(' Finished in ' + time_to_complete + ' seconds.');
            this.get('overlay').delay(5000).fadeOut('slow');
            this.get('progress').delay(5000).fadeOut('slow');
        },
        save_html_dimensions: function() {
            this.set('original_width', $('html').width());
            this.set('original_height', $('html').height());
        },
        full_screen: function() {
            $('html').width('100%');
            //$('html').height('100%');
        },
        restore_html_dimensions: function() {
            $('html').width(this.get('original_width'));
            //$('html').height(this.get('original_height'));
        }
});


/**
 * COLLECTIONS:
 * ------------------------------------------------
 * 
 */

/**
 * a bill is a collection of cost activities
 */
var bill = Backbone.Collection.extend({
	model: cost_activity,
        initialize: function() {
            this.reset_totals();
            this.on('add', this.compute_subtotals, this);
            this.on('reset', this.reset_totals, this);
        },
        reset_totals: function() {
            this.subtotals = {
                month: {tally: {}, name: 'Month', unit: 'Dollars'},
                project: {tally: {}, name: 'Project', unit: 'Dollars'},
                month_project: {tally: {}, name: 'Month and Project', unit: 'Dollars'},
                month_project_item_hours: {tally: {}, name: 'Month, Project, Item', unit: 'Hours'}
            };
            this.total = 0;            
        },
        get_all_subtotals: function() {
            
        },
        compute_subtotals: function(cost) {
            var year = cost.get('lab_activity').get('year');
            var month = cost.get('lab_activity').get('month');
            var lab_activity =  cost.get('lab_activity');
            var project = lab_activity.get('project').get('name');
            var charge = cost.get('charge');
            var item = lab_activity.get('item').get('name');
            var hours = cost.get('lab_activity').get('hours');
            
            //month subtotal
            var month_key = '' + month + ', ' + year;
            this.add_subtotal_by_key(month_key, 'month', charge);

            //project subtotal
            this.add_subtotal_by_key(project, 'project', charge);

            //month_project subtotal
            var key = month_key + ': "' + project + '"'; 
            this.add_subtotal_by_key(key, 'month_project', charge);

            //month_project_item_hours
            var mpih_key = key + ': "' + item + '"';
            this.add_subtotal_by_key(mpih_key, 'month_project_item_hours', hours);
            
            this.total += charge;
        },
        add_subtotal_by_key: function(key, subtotal, charge) {
            if (key in this.subtotals[subtotal]['tally']) {
                this.subtotals[subtotal]['tally'][key] += charge;
            } else {
                this.subtotals[subtotal]['tally'][key] = charge;
            }
        },
        total: function() {
            return this.total;
        },
        get_subtotal: function(subtotal, key) {
            if (subtotal in this.subtotals) {
                if (key in this.subtotals[subtotal]['tally']) {
                    return this.subtotals[subtotal]['tally'][key];
                }
            }
            return 0;
        },
        project_subtotal: function(project) {
            return this.get_subtotal('project', project);
        },
        month_subtotal: function(year, month) {
            var month_key = '' + month + ', ' + year;
            return this.get_subtotal('month', month_key);
        },
        month_project_subtotal: function(year, month, project) {
            var month_key = '' + month + ', ' + year;
            var key = month_key + ': "' + project + '"'; 
            return this.get_subtotal('month_project', key);
        }
});

/**
 * item_catalog is a collection of items
 */
var item_catalog = Backbone.Collection.extend({
		model: item,
                initialize: function() {
                    this.indices = {};
                    this.on('add', this.create_index_for_name, this);
                },
                create_index_for_name: function(obj) {
                    var indices = this.indices;
                    var key = obj.get('name');
                    if (key in indices) {
                        
                    } else {
                        var i = this.indexOf(obj);
                        indices[obj.get('name')] = i;
                    }
                },
		find_by_name: function(name) {
                    var indices = this.indices;
                    if (name in indices) {
                        var i = indices[name];    
                        return this.at(i);
                    }
                    return undefined;
		}
	});

/**
 * tier_catalog is a collection of items
 */
var tier_catalog = Backbone.Collection.extend({
		model: tier
	});
        
/**
 * error_log is a collection of error messages
 */
var error_log = Backbone.Collection.extend({
		model: error
	});

/**
 * project_catalog is a collection of projects
 */
var project_catalog = Backbone.Collection.extend({
		model: project,
                indices: {},
                initialize: function() {
                    this.indices = {};
                    this.on('add', this.create_index_for_name, this);
                },
                create_index_for_name: function(obj) {
                    var indices = this.indices;
                    var key = obj.get('name');
                    if (key in indices) {
                        
                    } else {
                        var i = this.indexOf(obj);
                        indices[obj.get('name')] = i;
                    }
                },
		find_by_name: function(name) {
                    var indices = this.indices;
                    if (name in indices) {
                        var i = indices[name];    
                        return this.at(i);
                    }
                    return undefined;
		}
	});

/**
 * lab_activity_catalog is a collection of lab_activity objects
 */
var lab_activity_catalog = Backbone.Collection.extend({
		model: lab_activity
	});
        
/**
 * VIEWS:
 * ------------------------------------------------
 */
    var activity_view = Backbone.View.extend({
        model: lab_activity,
        tagName: 'tr',
        template: _.template('<td><%=member %></td>\n\
                                    <td><%=project %></td>\n\
                                    <td><%=type %></td>\n\
                                    <td><%=item %></td>\n\
                                    <td><%=begin %></td>\n\
                                    <td><%=end %></td>\n\
                                '),
        initialize: function() {
          this.model.on('change', this.render, this);
          this.render();  
        },
        render: function() {
            var markup = this.template({
                                        member: this.model.get('member'),
                                        type: this.model.get('type'),
                                        project: this.model.get('project'),
                                        item: this.model.get('item'),
                                        begin: this.model.get('bdate'),
                                        end: this.model.get('edate')
                                    });
            this.$el.html(markup);
        }
    });
    
    var activities_view = Backbone.View.extend({
        tagName: 'table',
        initialize: function(attributes) {
          this.model.on('add', this.add_item, this);
          this.model.on('reset', this.rerender, this);
          $(attributes.selector).html(this.el);
          this.first_render();  
        },
        add_item: function(item) {
            var my_activity_view = new activity_view({model: item});
            this.$el.append(my_activity_view.el);
        },
        rerender: function() {
          this.$el.html('');
          this.first_render();
        },
        first_render: function() {
            var me = this;
            this.model.each(function(item) {
               me.add_item(item); 
            });
        }
    });
    
    var bill_calendar_view = Backbone.View.extend({
        model: bill,
        tagName: 'table',
        month_views: [],
        initialize: function(attributes) {
          $(attributes.selector).html(this.el);
          this.first_render();  
          this.model.on('reset', this.first_render, this);
	  this.month_views = [];
        },
        first_render: function() {
            this.$el.html('');
            var year = 2010;
            var month = 8;
            while (!( month == 9 && year == 2012 ))  {
                var current_month_view = new bill_month_view({model: this.model, attributes: {'data-month': month, 'data-year': year}});
		this.month_views.push(current_month_view);
                this.$el.append(current_month_view.el);
                
                month++;
                if (month == 13) {
                    month = 1;
                    year++;
                }
            }
        }
    });
    
    var bill_month_view = Backbone.View.extend({
        model: bill,
        tagName: 'tr',
        template: _.template('<td><%=month %></td><td>$<%=amount %></td>'),
        initialize: function() {
          this.model.on('add', this.render, this);
          this.model.on('reset', this.render, this);
          this.render();  
        },
        render: function() {
            var month = this.attributes['data-month'];
            var year = this.attributes['data-year'];
            var markup = this.template({month: month + ', ' + year,
                                        amount: this.model.month_subtotal(year, month).toFixed(2)
                                    });
            this.$el.html(markup);
        }
    });
    
    
    var projects_view = Backbone.View.extend({
        model: project_catalog,
        tagName: 'table',
        template: _.template('<tr><td><%=name%></td><td><%=type%></td></tr>'),
        initialize: function(attributes) {
          $(attributes.selector).html(this.el);
          this.model.on('add', this.render, this);
          this.model.on('reset', this.render, this);
          this.render();  
        },
        render: function() {
            var markup = '<tr><th>Project</th><th>Type</th></tr>';
            this.model.each(function(project) {
                markup += this.template({name: project.get('name'),
                                        type: project.get('type') });
            }, this);
            this.$el.html(markup);
        }
    });
    
    var lab_activity_view = Backbone.View.extend({
        model: lab_activity_catalog,
        tagName: 'table',
        template: _.template('<tr><td><%=project%></td><td><%=month%></td><td><%=tool%></td><td><%=hours%></td></tr>'),
        initialize: function(attributes) {
          $(attributes.selector).html(this.el);
          this.model.on('add', this.render, this);
          this.model.on('reset', this.render, this);
          this.render();  
        },
        render: function() {
            var markup = '<thead><tr><th>Project</th><th>Month</th><th>Tool</th><th>Hours</th></tr></thead>';
            this.model.each(function(activity) {
                markup += this.template({project: activity.get('project').get('name'),
                                        month: activity.get('year') + ' ' + activity.get('month'),
                                        tool: activity.get('item').get('name'),
                                        hours: activity.get('hours')
                                    });
            }, this);
            this.$el.html('<tbody>' + markup + '</tbody>');
            //this.$el.dataTable();
        }
    });
    
    var summary_view  = Backbone.View.extend({
        model: bill,
        tagName: 'table',
        template: _.template('<tr><td colspan="2"><strong><%=title %></strong></td></tr>\n\
                                <%=innards%>'),
        entry_template: _.template('<tr><td><%=name%>:</td><td><%=value%></td></tr>'),
        initialize: function() {
          this.render();  
        },
        render: function() {
            var markup = '' ;
            for (var subtotal in this.model.subtotals) {
                var innards = '';
                var sub = this.model.subtotals[subtotal];
                
                var keys = [];
                for (var item in sub.tally) {
                    keys.push(item);
                }
                keys.sort(function(a,b) {
                    if (a == b) {
                        return 0;
                    }
                    var date_regex = /(\d\d?), (\d\d\d\d)/;
                    if (date_regex.test(a) && date_regex.test(b)) {
                        var a_month = date_regex.exec(a)[1];
                        var a_year = date_regex.exec(a)[2];
                        var b_month = date_regex.exec(b)[1];
                        var b_year = date_regex.exec(b)[2];
                        var a_date = new Date(a_month + '/' + '01' + '/' + a_year);
                        var b_date = new Date(b_month + '/' + '01' + '/' + b_year);
                        
                        if (a_date.getTime() < b_date.getTime()) {
                            return -1;
                        } else {
                            return 1;
                        }
                    } else {
                        if (a < b) {
                            return -1;
                        } else {
                            return 1;
                        }
                    }
                });
                
                for (var key in keys) {
                    var item = keys[key];
                    var val;
                    if (sub.unit == 'Dollars') {
                        val = '$' + sub.tally[item].toFixed(2);
                    } else {
                        val = sub.tally[item].toFixed(2) + ' ' + sub.unit;
                    }
                    innards += this.entry_template({name: item, value: val });
                }
                markup += this.template({title: sub.name, innards: innards});
            }
            this.$el.html(markup);
        }
    });
    
    var tier_view = Backbone.View.extend({
        model: tier,
        tagName: 'div',
        template: _.template('<label><%=name %> Rate<input name="rate" type="text" value="<%=rate %>" /></label>\
                                <label><%=name %> External Rate<input name="external_rate" type="text" value="<%=external_rate %>" /></label>'),
        events: {
            "change input"      : "update_rate"
        },
        update_rate: function(obj) {
            var external_rate = this.$el.find('input[name=external_rate]').val() ;
            var rate = this.$el.find('input[name=rate]').val() ;
            this.model.set('rate', rate );
            this.model.set('external_rate', external_rate );
        },
        initialize: function(attributes) {
          $(attributes.selector).html(this.el);
          this.first_render();  
            this.model.on('change', this.first_render, this);
        },
        first_render: function() {
            this.$el.html(this.template({name: this.model.get('name'),
                                        rate: this.model.get('rate'),
                                        external_rate: this.model.get('external_rate')}));
        }
    });
    
    var cap_view = Backbone.View.extend({
        model: cap,
        tagName: 'div',
        template: _.template('<label>Cap (in dollars)<input type="text" name="threshold" value="<%=threshold %>" /></label>'
                            + '<label>Cap reduction (between 0 and 1, 1 is no reduction)<input type="text" name="rate" value="<%=rate %>" /></label>'),
        events: {
            "change input"      : "update_rate"
        },
        update_rate: function(obj) {
            this.model.set('rate', this.$el.find('input[name=rate]').val() );
            this.model.set('threshold', this.$el.find('input[name=threshold]').val() );
        },
        initialize: function(attributes) {
          $(attributes.selector).html(this.el);
          this.first_render();  
          this.model.on('change', this.first_render, this);
        },
        first_render: function() {
            this.$el.html(this.template({threshold: this.model.get('threshold'), rate: this.model.get('rate')}));
        }
    });
    
    var error_log_view = Backbone.View.extend({
        model: error_log,
        tagName: 'ul',
        template: _.template('<li><%=message%></li>'),
        initialize: function(attributes) {
          $(attributes.selector).html(this.el);
          this.first_render();  
          this.model.on('change', this.first_render, this);
          this.model.on('add', this.add_message, this);
        },
	add_message: function(err) {
		var timestamp = new Date();
		var formatted_timestamp = timestamp.getHours() + ':' + timestamp.getMinutes() + ':' + timestamp.getSeconds();
            this.$el.append(this.template({message: formatted_timestamp + ' ' + err.get('message')}));
	},
        first_render: function() {
        }
    });
    

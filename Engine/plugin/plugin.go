package plugins

import "sync"

/*
Generic graph models
You can move these later to /shared
*/

type Node struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Value string `json:"value"`
}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
	Type string `json:"type"`
}

type Result struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

/*
Collector interface
Every plugin must implement this
*/

type Collector interface {
	Name() string
	InputTypes() []string
	Run(Node) (*Result, error)
}

var (
	registry = map[string]Collector{}
	lock     sync.RWMutex
)

/*
RegisterCollector
Plugins call this in init()
*/

func RegisterCollector(c Collector) {
	lock.Lock()
	defer lock.Unlock()

	registry[c.Name()] = c
}

/*
Get all collectors
*/

func GetCollectors() []Collector {

	lock.RLock()
	defer lock.RUnlock()

	list := []Collector{}

	for _, c := range registry {
		list = append(list, c)
	}

	return list
}

/*
Find collectors for a specific node type
*/

func GetCollectorsFor(nodeType string) []Collector {

	lock.RLock()
	defer lock.RUnlock()

	list := []Collector{}

	for _, c := range registry {

		for _, t := range c.InputTypes() {
			if t == nodeType {
				list = append(list, c)
			}
		}

	}

	return list
}
